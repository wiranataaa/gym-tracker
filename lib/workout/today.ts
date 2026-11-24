import { roundingStep } from "../program/progression.ts";
import { nextProgramDay } from "../program/queue.ts";
import { isoWeekday } from "../time.ts";
import {
  closeStaleSessions,
  getFinishedSession,
  getHistory,
  getOpenSession,
  getSessionSets,
  getSettings,
  getTodayPlan,
  loadProgram,
  loadRecentSessions,
  type SessionRow,
  type SetRow,
} from "./db.ts";
import { buildMenu } from "./menu.ts";

// Data yang dibutuhkan halaman "Hari ini" di app. Semua angka dari kode, bukan AI.

export type ExerciseView = {
  exerciseId: number;
  name: string;
  sets: number;
  repMin: number;
  repMax: number;
  targetWeightKg: number | null;
  targetReps: number;
  note: string;
  /** langkah tombol +/- beban */
  stepKg: number;
};

export type LoggedSet = { id: number; exerciseId: number; weightKg: number; reps: number; rpe: number | null; isWarmup: boolean };

export type Recap = {
  dayName: string;
  energy: number | null;
  totalSets: number;
  volumeKg: number;
  exercises: { name: string; sets: number; bestWeightKg: number; bestReps: number; prevText: string | null }[];
  nextDayName: string | null;
};

export type TodayView =
  | { kind: "tanpa_program" }
  | { kind: "istirahat"; dayName: string }
  | { kind: "skip" }
  | { kind: "siap"; dayName: string; mode: "normal" | "singkat"; exercises: ExerciseView[]; targetKcal: number; targetProteinG: number }
  | { kind: "berjalan"; dayName: string; mode: "normal" | "singkat"; sessionId: number; exercises: ExerciseView[]; logged: LoggedSet[] }
  | { kind: "selesai"; recap: Recap };

function toView(menu: NonNullable<Awaited<ReturnType<typeof buildMenu>>>): ExerciseView[] {
  return menu.items.map((p) => ({
    exerciseId: p.exercise.id,
    name: p.exercise.name,
    sets: p.sets,
    repMin: p.repMin,
    repMax: p.repMax,
    targetWeightKg: p.target.weightKg,
    targetReps: p.target.reps,
    note: p.target.note,
    stepKg: roundingStep(p.exercise.increment_kg),
  }));
}

function toLogged(rows: SetRow[]): LoggedSet[] {
  return rows.map((r) => ({
    id: r.id,
    exerciseId: r.exercise_id,
    weightKg: r.weight_kg,
    reps: r.reps,
    rpe: r.rpe,
    isWarmup: r.is_warmup,
  }));
}

async function buildRecap(session: SessionRow, today: string): Promise<Recap> {
  const [rows, { days, items }, sessions] = await Promise.all([getSessionSets(session.id), loadProgram(), loadRecentSessions()]);
  const working = rows.filter((r) => !r.is_warmup);
  const names = new Map(items.map((i) => [i.exercise.id, i.exercise.name]));

  const ids = [...new Set(working.map((r) => r.exercise_id))];
  const history = await getHistory(ids, today);

  const exercises = ids.map((id) => {
    const list = working.filter((r) => r.exercise_id === id);
    const bestW = Math.max(...list.map((r) => r.weight_kg));
    const bestR = Math.max(...list.filter((r) => r.weight_kg === bestW).map((r) => r.reps));
    const last = history.get(id)?.[0];
    let prevText: string | null = null;
    if (last) {
      const pw = Math.max(...last.sets.map((s) => s.weightKg));
      const pr = Math.max(...last.sets.filter((s) => s.weightKg === pw).map((s) => s.reps));
      prevText = `${pw} kg × ${pr}`;
    }
    return { name: names.get(id) ?? "Gerakan", sets: list.length, bestWeightKg: bestW, bestReps: bestR, prevText };
  });

  return {
    dayName: days.find((d) => d.id === session.program_day_id)?.name ?? "Latihan",
    energy: session.energy,
    totalSets: working.length,
    volumeKg: working.reduce((a, r) => a + r.weight_kg * r.reps, 0),
    exercises,
    nextDayName: nextProgramDay(days, sessions)?.name ?? null,
  };
}

export async function loadTodayView(today: string, force: boolean): Promise<TodayView> {
  // Sesi kemarin yang lupa ditutup dirapikan dulu supaya antrean benar
  await closeStaleSessions(today);

  const [settings, plan, open] = await Promise.all([getSettings(), getTodayPlan(today), getOpenSession(today)]);

  if (open) {
    const [menu, rows] = await Promise.all([buildMenu(today, open.mode), getSessionSets(open.id)]);
    if (!menu) return { kind: "tanpa_program" };
    return {
      kind: "berjalan",
      dayName: menu.day.name,
      mode: open.mode,
      sessionId: open.id,
      exercises: toView(menu),
      logged: toLogged(rows),
    };
  }

  const finished = await getFinishedSession(today);
  if (finished) return { kind: "selesai", recap: await buildRecap(finished, today) };

  if (plan?.status === "dilewati") return { kind: "skip" };

  const menu = await buildMenu(today, plan?.mode ?? "normal");
  if (!menu) return { kind: "tanpa_program" };

  if (!force && !settings.workout_days.includes(isoWeekday(today))) {
    return { kind: "istirahat", dayName: menu.day.name };
  }

  return {
    kind: "siap",
    dayName: menu.day.name,
    mode: menu.mode,
    exercises: toView(menu),
    targetKcal: settings.target_kcal,
    targetProteinG: settings.target_protein_g,
  };
}
