import { db, must } from "../supabase.ts";
import type { JenisHari, ProgramDay, SessionLite } from "../program/queue.ts";
import { ramadanAktif, type OverrideRamadan } from "../ramadan/ramadan.ts";
import { todayWIB } from "../time.ts";
import type { ExerciseSession } from "../program/types.ts";

export type ExerciseRow = {
  id: number;
  name: string;
  aliases: string[];
  muscle_group: string;
  kind: string;
  increment_kg: number;
  is_bodyweight: boolean;
};

export type DayExercise = {
  dayId: number;
  position: number;
  sets: number;
  repMin: number;
  repMax: number;
  isCore: boolean;
  exercise: ExerciseRow;
};

export type Settings = {
  /** Target kalori EFEKTIF hari ini: maintenance saat Ramadan, selain itu target biasa. */
  target_kcal: number;
  /** Target kalori biasa (lean bulk), tidak terpengaruh Ramadan. Ini yang disesuaikan otomatis tiap minggu. */
  target_kcal_normal: number;
  kcal_maintenance: number;
  target_protein_g: number;
  workout_days: number[];
  target_weight_kg: number;
  sessions_per_week: number;
  ramadan_aktif: boolean;
  ramadan_override: OverrideRamadan;
  ramadan_start: string;
  lebaran_date: string;
};

export type SessionRow = {
  id: number;
  session_date: string;
  program_day_id: number | null;
  mode: "normal" | "singkat";
  status: "berjalan" | "selesai" | "dilewati";
  energy: number | null;
  started_at: string;
  cardio_min: number | null;
};

export type SetRow = {
  id: number;
  exercise_id: number;
  set_number: number;
  weight_kg: number;
  reps: number;
  rpe: number | null;
  is_warmup: boolean;
};

export type PlanRow = {
  plan_date: string;
  program_day_id: number | null;
  mode: "normal" | "singkat";
  status: "disarankan" | "dikerjakan" | "dilewati";
};

const EXERCISE_COLS = "id,name,aliases,muscle_group,kind,increment_kg,is_bodyweight";
const SESSION_COLS = "id,session_date,program_day_id,mode,status,energy,started_at,cardio_min";

export async function loadExercises(): Promise<ExerciseRow[]> {
  return must(await db().from("exercises").select(EXERCISE_COLS).eq("is_active", true).order("id"));
}

export async function loadProgram(): Promise<{ days: ProgramDay[]; items: DayExercise[] }> {
  const days = (
    must(await db().from("program_days").select("id,position,name,kind").order("kind").order("position")) as {
      id: number;
      position: number;
      name: string;
      kind: JenisHari;
    }[]
  ).map((d) => ({ id: d.id, position: d.position, name: d.name, kind: d.kind }));

  const rows = must(
    await db()
      .from("program_day_exercises")
      .select(`program_day_id,position,sets,rep_min,rep_max,is_core,exercises(${EXERCISE_COLS})`)
      .order("program_day_id")
      .order("position"),
  ) as unknown as {
    program_day_id: number;
    position: number;
    sets: number;
    rep_min: number;
    rep_max: number;
    is_core: boolean;
    exercises: ExerciseRow;
  }[];

  const items = rows.map((r) => ({
    dayId: r.program_day_id,
    position: r.position,
    sets: r.sets,
    repMin: r.rep_min,
    repMax: r.rep_max,
    isCore: r.is_core,
    exercise: r.exercises,
  }));
  return { days, items };
}

type SettingsRow = {
  target_kcal: number;
  kcal_maintenance: number;
  target_protein_g: number;
  workout_days: number[];
  target_weight_kg: number;
  sessions_per_week: number;
  ramadan_override: OverrideRamadan;
  ramadan_start: string;
  lebaran_date: string;
};

export async function getSettings(today: string = todayWIB()): Promise<Settings> {
  const kolomLengkap =
    "target_kcal,kcal_maintenance,target_protein_g,workout_days,target_weight_kg,sessions_per_week,ramadan_override,ramadan_start,lebaran_date";
  const kolomLama = "target_kcal,target_protein_g,workout_days,target_weight_kg,sessions_per_week,ramadan_start,lebaran_date";

  let r: SettingsRow;
  const baru = await db().from("settings").select(kolomLengkap).eq("id", 1).single();
  if (baru.error) {
    // Kolom migrasi 007 belum ada (SQL belum dijalankan): pakai nilai bawaan supaya app tetap jalan
    const lama = must(await db().from("settings").select(kolomLama).eq("id", 1).single()) as Omit<SettingsRow, "kcal_maintenance" | "ramadan_override">;
    r = { ...lama, kcal_maintenance: 2450, ramadan_override: "auto" };
  } else {
    r = baru.data as SettingsRow;
  }
  const aktif = ramadanAktif(today, { override: r.ramadan_override, mulai: r.ramadan_start, lebaran: r.lebaran_date });
  return {
    ...r,
    target_kcal_normal: r.target_kcal,
    target_kcal: aktif ? r.kcal_maintenance : r.target_kcal,
    ramadan_aktif: aktif,
  };
}

export async function setRamadanOverride(v: OverrideRamadan): Promise<void> {
  must(await db().from("settings").update({ ramadan_override: v, updated_at: new Date().toISOString() }).eq("id", 1));
}

export async function loadRecentSessions(limit = 30): Promise<(SessionLite & { id: number })[]> {
  const rows = must(
    await db()
      .from("workout_sessions")
      .select("id,program_day_id,status,started_at,session_date")
      .order("started_at", { ascending: false })
      .limit(limit),
  ) as { id: number; program_day_id: number | null; status: SessionLite["status"]; started_at: string; session_date: string }[];
  return rows.map((r) => ({ id: r.id, programDayId: r.program_day_id, status: r.status, startedAt: r.started_at, date: r.session_date }));
}

// ---------- Rencana harian (mode normal/singkat, skip) ----------

export async function getTodayPlan(today: string): Promise<PlanRow | null> {
  return must(
    await db().from("daily_plans").select("plan_date,program_day_id,mode,status").eq("plan_date", today).maybeSingle(),
  );
}

export async function savePlan(
  today: string,
  patch: { program_day_id?: number | null; mode?: "normal" | "singkat"; status?: PlanRow["status"]; plan?: unknown },
): Promise<void> {
  must(await db().from("daily_plans").upsert({ plan_date: today, ...patch }, { onConflict: "plan_date" }));
}

// ---------- Sesi latihan ----------

export async function getOpenSession(today: string): Promise<SessionRow | null> {
  return must(
    await db()
      .from("workout_sessions")
      .select(SESSION_COLS)
      .eq("status", "berjalan")
      .eq("session_date", today)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  );
}

/** Sesi "berjalan" dari hari lalu yang lupa ditutup: tutup otomatis. */
export async function closeStaleSessions(today: string): Promise<void> {
  const stale = must(
    await db().from("workout_sessions").select("id").eq("status", "berjalan").lt("session_date", today),
  ) as { id: number }[];

  for (const s of stale) {
    const { count } = await db().from("workout_sets").select("id", { count: "exact", head: true }).eq("session_id", s.id);
    must(
      await db()
        .from("workout_sessions")
        .update({ status: (count ?? 0) > 0 ? "selesai" : "dilewati", ended_at: new Date().toISOString() })
        .eq("id", s.id),
    );
  }
}

export async function startSession(today: string, programDayId: number, mode: "normal" | "singkat"): Promise<SessionRow> {
  return must(
    await db()
      .from("workout_sessions")
      .insert({ session_date: today, program_day_id: programDayId, mode })
      .select(SESSION_COLS)
      .single(),
  );
}

export async function getSessionSets(sessionId: number): Promise<SetRow[]> {
  return must(
    await db()
      .from("workout_sets")
      .select("id,exercise_id,set_number,weight_kg,reps,rpe,is_warmup")
      .eq("session_id", sessionId)
      .order("id"),
  );
}

export async function logSets(args: {
  sessionId: number;
  exerciseId: number;
  weightKg: number;
  reps: number[];
  rpe: number | null;
  isWarmup: boolean;
}): Promise<void> {
  const existing = must(
    await db()
      .from("workout_sets")
      .select("set_number")
      .eq("session_id", args.sessionId)
      .eq("exercise_id", args.exerciseId)
      .eq("is_warmup", args.isWarmup),
  ) as { set_number: number }[];
  const start = existing.reduce((m, r) => Math.max(m, r.set_number), 0);

  must(
    await db()
      .from("workout_sets")
      .insert(
        args.reps.map((reps, i) => ({
          session_id: args.sessionId,
          exercise_id: args.exerciseId,
          set_number: start + i + 1,
          weight_kg: args.weightKg,
          reps,
          rpe: args.rpe,
          is_warmup: args.isWarmup,
        })),
      ),
  );
}

export async function getSessionById(id: number): Promise<SessionRow | null> {
  return must(await db().from("workout_sessions").select(SESSION_COLS).eq("id", id).maybeSingle());
}

export async function saveCardio(sessionId: number, minutes: number | null): Promise<void> {
  must(await db().from("workout_sessions").update({ cardio_min: minutes }).eq("id", sessionId));
}

export async function finishSession(sessionId: number, energy: number | null): Promise<void> {
  must(
    await db()
      .from("workout_sessions")
      .update({ status: "selesai", ended_at: new Date().toISOString(), energy })
      .eq("id", sessionId),
  );
}

export async function getFinishedSession(today: string): Promise<SessionRow | null> {
  return must(
    await db()
      .from("workout_sessions")
      .select(SESSION_COLS)
      .eq("status", "selesai")
      .eq("session_date", today)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  );
}

export async function deleteSet(setId: number): Promise<void> {
  must(await db().from("workout_sets").delete().eq("id", setId));
}

// ---------- Riwayat per gerakan ----------

/** Riwayat working set per gerakan dari sesi SEBELUM tanggal `before` (sesi terbaru dulu). */
export async function getHistory(exerciseIds: number[], before: string): Promise<Map<number, ExerciseSession[]>> {
  const out = new Map<number, ExerciseSession[]>();
  if (exerciseIds.length === 0) return out;

  const rows = must(
    await db()
      .from("workout_sets")
      .select("exercise_id,weight_kg,reps,rpe,workout_sessions!inner(session_date,status)")
      .in("exercise_id", exerciseIds)
      .eq("is_warmup", false)
      .in("workout_sessions.status", ["berjalan", "selesai"])
      .lt("workout_sessions.session_date", before)
      .order("id", { ascending: false })
      .limit(1500),
  ) as unknown as {
    exercise_id: number;
    weight_kg: number;
    reps: number;
    rpe: number | null;
    workout_sessions: { session_date: string };
  }[];

  const byKey = new Map<string, ExerciseSession>();
  for (const r of rows) {
    const key = `${r.exercise_id}|${r.workout_sessions.session_date}`;
    let s = byKey.get(key);
    if (!s) {
      s = { date: r.workout_sessions.session_date, sets: [] };
      byKey.set(key, s);
      const list = out.get(r.exercise_id) ?? [];
      list.push(s);
      out.set(r.exercise_id, list);
    }
    s.sets.push({ weightKg: r.weight_kg, reps: r.reps, rpe: r.rpe });
  }
  for (const list of out.values()) list.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return out;
}

// ---------- Timbangan ----------

export async function addWeight(
  weightKg: number,
  condition: "sebelum_latihan" | "pagi_puasa" | "setelah_olahraga" | "setelah_makan" | "lainnya",
): Promise<{ previous: number | null; avg7: number }> {
  const prev = must(
    await db()
      .from("body_measurements")
      .select("weight_kg")
      .order("measured_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ) as { weight_kg: number } | null;

  must(
    await db()
      .from("body_measurements")
      .insert({ measured_at: new Date().toISOString(), weight_kg: weightKg, condition, source: "telegram" }),
  );

  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const recent = must(
    await db().from("body_measurements").select("weight_kg").gte("measured_at", since),
  ) as { weight_kg: number }[];
  const avg7 = recent.reduce((s, r) => s + Number(r.weight_kg), 0) / Math.max(1, recent.length);
  return { previous: prev ? Number(prev.weight_kg) : null, avg7 };
}
