import { db, must } from "../supabase.ts";
import { bacaDaftarGanti, type Ganti } from "../program/ganti.ts";
import { hitungSet, ubahDilewati } from "../program/lewati.ts";
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
  equipment: string;
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
  /** minggu deload (ringan) sedang berjalan? */
  deload_aktif: boolean;
  deload_sampai: string | null;
  deload_terakhir: string | null;
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

const EXERCISE_COLS = "id,name,aliases,muscle_group,kind,equipment,increment_kg,is_bodyweight";
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
  deload_sampai: string | null;
  deload_terakhir: string | null;
};

const KOLOM_DASAR = "target_kcal,target_protein_g,workout_days,target_weight_kg,sessions_per_week,ramadan_start,lebaran_date";
const KOLOM_007 = `${KOLOM_DASAR},kcal_maintenance,ramadan_override`;
const KOLOM_008 = `${KOLOM_007},deload_sampai,deload_terakhir`;

/**
 * Pengaturan efektif hari ini. Tahan terhadap migrasi yang belum dijalankan: kalau kolom baru
 * (007/008) belum ada, dipakai nilai bawaan supaya app tetap jalan.
 */
export async function getSettings(today: string = todayWIB()): Promise<Settings> {
  let r: SettingsRow;
  const penuh = await db().from("settings").select(KOLOM_008).eq("id", 1).single();
  if (!penuh.error) {
    r = penuh.data as unknown as SettingsRow;
  } else {
    const tengah = await db().from("settings").select(KOLOM_007).eq("id", 1).single();
    if (!tengah.error) {
      r = { ...(tengah.data as unknown as Omit<SettingsRow, "deload_sampai" | "deload_terakhir">), deload_sampai: null, deload_terakhir: null };
    } else {
      const lama = must(await db().from("settings").select(KOLOM_DASAR).eq("id", 1).single()) as unknown as Omit<
        SettingsRow,
        "kcal_maintenance" | "ramadan_override" | "deload_sampai" | "deload_terakhir"
      >;
      r = { ...lama, kcal_maintenance: 2450, ramadan_override: "auto", deload_sampai: null, deload_terakhir: null };
    }
  }

  const aktif = ramadanAktif(today, { override: r.ramadan_override, mulai: r.ramadan_start, lebaran: r.lebaran_date });
  return {
    ...r,
    target_kcal_normal: r.target_kcal,
    target_kcal: aktif ? r.kcal_maintenance : r.target_kcal,
    ramadan_aktif: aktif,
    deload_aktif: !!r.deload_sampai && today <= r.deload_sampai,
  };
}

/** Mulai minggu deload: 7 hari mulai hari ini. Butuh migrasi 008. */
export async function mulaiDeload(today: string): Promise<string> {
  const sampai = new Date(Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10)) + 6 * 86_400_000).toISOString().slice(0, 10);
  must(await db().from("settings").update({ deload_sampai: sampai, deload_terakhir: today, updated_at: new Date().toISOString() }).eq("id", 1));
  return sampai;
}

export async function akhiriDeload(): Promise<void> {
  must(await db().from("settings").update({ deload_sampai: null, updated_at: new Date().toISOString() }).eq("id", 1));
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

/** Gerakan yang sisa setnya dilewati di sesi ini. Kosong kalau kolomnya belum ada (SQL 011 belum dijalankan). */
export async function getSkipped(sessionId: number): Promise<number[]> {
  const { data, error } = await db().from("workout_sessions").select("skipped_exercises").eq("id", sessionId).maybeSingle();
  const list = (data as { skipped_exercises?: unknown } | null)?.skipped_exercises;
  if (error || !Array.isArray(list)) return [];
  return list.filter((x): x is number => Number.isInteger(x));
}

export async function setSkipped(sessionId: number, exerciseId: number, lewati: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  const baru = ubahDilewati(await getSkipped(sessionId), exerciseId, lewati);
  const { error } = await db().from("workout_sessions").update({ skipped_exercises: baru }).eq("id", sessionId);
  if (!error) return { ok: true };
  const belumAda = /skipped_exercises/.test(error.message);
  return { ok: false, error: belumAda ? "Fitur lewati belum aktif. Jalankan file supabase/011_satu_jam_dan_lewati.sql di Supabase dulu." : "Gagal menyimpan, coba lagi." };
}

/** Penggantian gerakan di satu sesi. Kosong kalau kolomnya belum ada (SQL 012 belum dijalankan). */
export async function getSwaps(sessionId: number): Promise<Ganti[]> {
  const { data, error } = await db().from("workout_sessions").select("swaps").eq("id", sessionId).maybeSingle();
  if (error) return [];
  return bacaDaftarGanti((data as { swaps?: unknown } | null)?.swaps);
}

export async function saveSwaps(sessionId: number, daftar: Ganti[]): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await db().from("workout_sessions").update({ swaps: daftar }).eq("id", sessionId);
  if (!error) return { ok: true };
  const belumAda = /swaps/.test(error.message);
  return { ok: false, error: belumAda ? "Fitur ganti gerakan belum aktif. Jalankan file supabase/012_ganti_gerakan.sql di Supabase dulu." : "Gagal menyimpan, coba lagi." };
}

/**
 * Penggantian yang berlaku untuk menu hari program itu di tanggal itu (sesi terbaru), beserta
 * jumlah set kerja per gerakan di sesi tersebut. Kosong kalau belum ada sesi atau belum ada penggantian.
 */
export async function swapsUntukMenu(tanggal: string, dayId: number): Promise<{ daftar: Ganti[]; selesai: Map<number, number> }> {
  const kosong = { daftar: [] as Ganti[], selesai: new Map<number, number>() };
  const { data, error } = await db()
    .from("workout_sessions")
    .select("id,swaps")
    .eq("session_date", tanggal)
    .eq("program_day_id", dayId)
    .in("status", ["berjalan", "selesai"])
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return kosong;
  const row = data as { id: number; swaps?: unknown };
  const daftar = bacaDaftarGanti(row.swaps);
  if (daftar.length === 0) return kosong;
  const sets = await getSessionSets(row.id);
  return { daftar, selesai: hitungSet(sets.filter((s) => !s.is_warmup).map((s) => s.exercise_id)) };
}

export async function logSets(args: {
  sessionId: number;
  exerciseId: number;
  weightKg: number;
  reps: number[];
  rpe: number | null;
  isWarmup: boolean;
}): Promise<void> {
  // Ternyata masih lanjut gerakan yang tadi dilewati: batalkan status lewatinya
  if (!args.isWarmup && (await getSkipped(args.sessionId)).includes(args.exerciseId)) await setSkipped(args.sessionId, args.exerciseId, false);
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
