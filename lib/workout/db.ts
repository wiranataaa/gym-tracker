import { db, must } from "../supabase.ts";
import type { ProgramDay, SessionLite } from "../program/queue.ts";
import type { ExerciseSession } from "../program/types.ts";

export type ExerciseRow = {
  id: number;
  name: string;
  aliases: string[];
  muscle_group: string;
  kind: string;
  increment_kg: number;
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
  target_kcal: number;
  target_protein_g: number;
  workout_days: number[];
  target_weight_kg: number;
};

export type SessionRow = {
  id: number;
  session_date: string;
  program_day_id: number | null;
  mode: "normal" | "singkat";
  status: "berjalan" | "selesai" | "dilewati";
  energy: number | null;
  started_at: string;
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

const EXERCISE_COLS = "id,name,aliases,muscle_group,kind,increment_kg";

export async function loadExercises(): Promise<ExerciseRow[]> {
  return must(await db().from("exercises").select(EXERCISE_COLS).eq("is_active", true).order("id"));
}

export async function loadProgram(): Promise<{ days: ProgramDay[]; items: DayExercise[] }> {
  const days = must(
    await db().from("program_days").select("id,position,name").order("position"),
  ) as ProgramDay[];

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

export async function getSettings(): Promise<Settings> {
  return must(
    await db().from("settings").select("target_kcal,target_protein_g,workout_days,target_weight_kg").eq("id", 1).single(),
  );
}

export async function loadRecentSessions(limit = 30): Promise<(SessionLite & { id: number })[]> {
  const rows = must(
    await db()
      .from("workout_sessions")
      .select("id,program_day_id,status,started_at")
      .order("started_at", { ascending: false })
      .limit(limit),
  ) as { id: number; program_day_id: number | null; status: SessionLite["status"]; started_at: string }[];
  return rows.map((r) => ({ id: r.id, programDayId: r.program_day_id, status: r.status, startedAt: r.started_at }));
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
      .select("id,session_date,program_day_id,mode,status,energy,started_at")
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
      .select("id,session_date,program_day_id,mode,status,energy,started_at")
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

export async function finishSession(sessionId: number, energy: number | null): Promise<void> {
  must(
    await db()
      .from("workout_sessions")
      .update({ status: "selesai", ended_at: new Date().toISOString(), energy })
      .eq("id", sessionId),
  );
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

export async function addWeight(weightKg: number, condition: "pagi_puasa" | "lainnya"): Promise<{ previous: number | null; avg7: number }> {
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
