import { ambilKesimpulan } from "../ai/summary.ts";
import { statusTimbang } from "../body/db.ts";
import { pengingatTimbang } from "../bot/pengingat.ts";
import type { Kardio } from "../program/kardio.ts";
import { roundingStep } from "../program/progression.ts";
import { hitungSet, teksDilewati } from "../program/lewati.ts";
import { awalMinggu } from "../report/hitung.ts";
import { isoWeekday } from "../time.ts";
import { pratinjauBerikutnya, type Pratinjau } from "./berikutnya.ts";
import {
  closeStaleSessions,
  getFinishedSession,
  getHistory,
  getOpenSession,
  getSessionSets,
  getSettings,
  getSkipped,
  getTodayPlan,
  loadExercises,
  loadProgram,
  loadRecentSessions,
  type SessionRow,
  type SetRow,
  type Settings,
} from "./db.ts";
import { buildMenu, type TodayMenu } from "./menu.ts";

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
  /** gerakan berat badan sendiri (beban awal 0) */
  bodyweight: boolean;
  /** jenis gerakan, menentukan lama istirahat antar set */
  jenis: "compound" | "isolation";
};

export type LoggedSet = { id: number; exerciseId: number; weightKg: number; reps: number; rpe: number | null; isWarmup: boolean };

export type PilihanMenu = { id: number; name: string; bonus: boolean };

export type Recap = {
  dayName: string;
  energy: number | null;
  cardioMin: number | null;
  totalSets: number;
  volumeKg: number;
  exercises: { name: string; sets: number; bestWeightKg: number; bestReps: number; prevText: string | null }[];
  /** teks siap tampil untuk gerakan yang dilewati sisa setnya */
  dilewati: string[];
};

export type TodayView =
  | { kind: "tanpa_program" }
  | { kind: "istirahat"; dayName: string; berikutnya: Pratinjau | null }
  | { kind: "skip"; berikutnya: Pratinjau | null }
  | {
      kind: "siap";
      dayId: number;
      dayName: string;
      bonus: boolean;
      mode: "normal" | "singkat";
      exercises: ExerciseView[];
      kardio: Kardio;
      pilihan: PilihanMenu[];
      timbang: string | null;
      targetKcal: number;
      targetProteinG: number;
      ramadan: boolean;
      deload: boolean;
    }
  | {
      kind: "berjalan";
      dayName: string;
      bonus: boolean;
      mode: "normal" | "singkat";
      sessionId: number;
      exercises: ExerciseView[];
      logged: LoggedSet[];
      /** id gerakan yang sisa setnya dilewati */
      skipped: number[];
      kardio: Kardio;
      cardioMin: number | null;
      timbang: string | null;
    }
  | { kind: "selesai"; recap: Recap; kesimpulan: string | null; timbang: string | null; berikutnya: Pratinjau | null };

function toView(menu: TodayMenu): ExerciseView[] {
  return menu.items.map((p) => ({
    exerciseId: p.exercise.id,
    name: p.exercise.name,
    sets: p.sets,
    repMin: p.repMin,
    repMax: p.repMax,
    targetWeightKg: p.exercise.is_bodyweight ? 0 : p.target.weightKg,
    targetReps: p.target.reps,
    note: p.target.note,
    stepKg: roundingStep(p.exercise.increment_kg),
    bodyweight: p.exercise.is_bodyweight,
    jenis: p.exercise.kind === "isolation" ? "isolation" : "compound",
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

/** Banner pengingat timbang (di gym, hari latihan terakhir minggu itu). null kalau nggak perlu. */
export async function bannerTimbang(today: string, settings: Settings): Promise<string | null> {
  const [st, sesi] = await Promise.all([statusTimbang(today), loadRecentSessions()]);
  const mulai = awalMinggu(today);
  const r = pengingatTimbang({
    today,
    hariSejakTimbang: st.hariSejak,
    sudahTimbangMingguIni: st.sudahMingguIni,
    sesiSelesaiMingguIni: sesi.filter((s) => s.status === "selesai" && (s.date ?? "") >= mulai).length,
    targetSesi: settings.sessions_per_week,
  });
  return r.perlu ? (r.baris[1] ?? null) : null;
}

async function buildRecap(session: SessionRow, today: string): Promise<Recap> {
  const [rows, { days }, daftar, skipped] = await Promise.all([getSessionSets(session.id), loadProgram(), loadExercises(), getSkipped(session.id)]);
  const working = rows.filter((r) => !r.is_warmup);
  // Nama dari daftar semua gerakan, bukan dari program: gerakan yang sudah dikeluarkan dari program tetap bernama
  const names = new Map(daftar.map((e) => [e.id, e.name]));

  let dilewati: string[] = [];
  if (skipped.length > 0) {
    const menu = await buildMenu(today, session.mode, session.program_day_id);
    const selesai = hitungSet(working.map((r) => r.exercise_id));
    dilewati = skipped.map((id) =>
      teksDilewati(names.get(id) ?? "Gerakan", selesai.get(id) ?? 0, menu?.items.find((p) => p.exercise.id === id)?.sets ?? null),
    );
  }

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
    cardioMin: session.cardio_min,
    totalSets: working.length,
    volumeKg: working.reduce((a, r) => a + r.weight_kg * r.reps, 0),
    exercises,
    dilewati,
  };
}

export async function loadTodayView(today: string, force: boolean): Promise<TodayView> {
  // Sesi kemarin yang lupa ditutup dirapikan dulu supaya antrean benar
  await closeStaleSessions(today);

  const [settings, plan, open] = await Promise.all([getSettings(), getTodayPlan(today), getOpenSession(today)]);

  if (open) {
    const [menu, rows, timbang, skipped] = await Promise.all([
      buildMenu(today, open.mode, open.program_day_id),
      getSessionSets(open.id),
      bannerTimbang(today, settings),
      getSkipped(open.id),
    ]);
    if (!menu) return { kind: "tanpa_program" };
    return {
      kind: "berjalan",
      dayName: menu.day.name,
      bonus: menu.jenis === "bonus",
      mode: open.mode,
      sessionId: open.id,
      exercises: toView(menu),
      logged: toLogged(rows),
      skipped,
      kardio: menu.kardio,
      cardioMin: open.cardio_min,
      timbang,
    };
  }

  const finished = await getFinishedSession(today);
  if (finished) {
    const [recap, kesimpulan, timbang, berikutnya] = await Promise.all([
      buildRecap(finished, today),
      ambilKesimpulan(today),
      bannerTimbang(today, settings),
      pratinjauBerikutnya(today, settings),
    ]);
    return { kind: "selesai", recap, kesimpulan, timbang, berikutnya };
  }

  if (plan?.status === "dilewati") return { kind: "skip", berikutnya: await pratinjauBerikutnya(today, settings) };

  const [menu, timbang] = await Promise.all([buildMenu(today, plan?.mode ?? "normal"), bannerTimbang(today, settings)]);
  if (!menu) return { kind: "tanpa_program" };

  if (!force && !settings.workout_days.includes(isoWeekday(today))) {
    return { kind: "istirahat", dayName: menu.day.name, berikutnya: await pratinjauBerikutnya(today, settings) };
  }

  return {
    kind: "siap",
    dayId: menu.day.id,
    dayName: menu.day.name,
    bonus: menu.jenis === "bonus",
    mode: menu.mode,
    exercises: toView(menu),
    kardio: menu.kardio,
    pilihan: menu.pilihan.map((d) => ({ id: d.id, name: d.name, bonus: d.kind === "bonus" })),
    timbang,
    targetKcal: settings.target_kcal,
    targetProteinG: settings.target_protein_g,
    ramadan: menu.ramadan,
    deload: menu.deload,
  };
}
