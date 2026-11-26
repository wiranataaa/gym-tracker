import { lajuBeratTerakhir } from "../body/db.ts";
import { PANDUAN_DELOAD, setDeload } from "../program/deload.ts";
import { rekomendasiKardio, type Kardio } from "../program/kardio.ts";
import { kurangiVolumeRamadan, SARAN_LATIHAN_RAMADAN } from "../ramadan/ramadan.ts";
import { terapkanGanti } from "../program/ganti.ts";
import { computeTarget } from "../program/progression.ts";
import { kindOf, pilihHariIni, type JenisHari, type ProgramDay } from "../program/queue.ts";
import { shortModeExercises } from "../program/shortMode.ts";
import type { ExerciseSession, Target } from "../program/types.ts";
import { fmtInt, fmtKg, isoWeekday, namaHari } from "../time.ts";
import { getHistory, getSettings, getTodayPlan, loadExercises, loadProgram, loadRecentSessions, swapsUntukMenu, type ExerciseRow, type Settings } from "./db.ts";

export type PlannedExercise = {
  exercise: ExerciseRow;
  position: number;
  sets: number;
  repMin: number;
  repMax: number;
  target: Target;
  /** terisi kalau gerakan ini pengganti (alat penuh) */
  gantiDari: { id: number; name: string } | null;
};

export type TodayMenu = {
  day: ProgramDay;
  jenis: JenisHari;
  mode: "normal" | "singkat";
  items: PlannedExercise[];
  kardio: Kardio;
  /** hari pemulihan (Bonus F): kardio dan core jadi menu utama */
  recovery: boolean;
  /** mode Ramadan aktif: volume dikurangi, target kalori maintenance */
  ramadan: boolean;
  /** minggu deload sedang berjalan: volume ±60% */
  deload: boolean;
  /** semua hari program, buat fitur "Ganti menu" */
  pilihan: ProgramDay[];
};

/** Jatah sesi hari utama per minggu sebelum menu bergeser ke bonus (jumlah hari utama: A, B, C). */
export const SESI_UTAMA_PER_MINGGU = 3;

const isRecovery = (d: ProgramDay) => /kardio|recovery/i.test(d.name);

/**
 * Susun menu hari ini: hari utama (A/B/C) sampai penuh 3x seminggu, lalu bonus (D/E/F) supaya latihan
 * tiap hari tetap bervariasi. Nata bisa mengganti menu sendiri (disimpan di daily_plans.program_day_id).
 * Target beban dan kardio dihitung kode, bukan AI.
 */
export async function buildMenu(today: string, mode: "normal" | "singkat", forceDayId?: number | null): Promise<TodayMenu | null> {
  const [{ days, items }, sessions, plan, settings, laju] = await Promise.all([
    loadProgram(),
    loadRecentSessions(),
    getTodayPlan(today),
    getSettings(),
    lajuBeratTerakhir(today).catch(() => null),
  ]);

  // Pilihan manual hari ini, kecuali hari itu sudah selesai dikerjakan (supaya sesi kedua nggak mengulang)
  let pilih: { day: ProgramDay; jenis: JenisHari } | null = null;
  if (forceDayId) {
    // Sesi yang sedang berjalan: hari programnya sudah pasti
    const d = days.find((x) => x.id === forceDayId);
    if (d) pilih = { day: d, jenis: kindOf(d) };
  }
  const overrideId = plan?.program_day_id ?? null;
  if (!pilih && overrideId) {
    const d = days.find((x) => x.id === overrideId);
    const sudahSelesai = sessions.some((s) => s.status === "selesai" && s.date === today && s.programDayId === overrideId);
    if (d && !sudahSelesai) pilih = { day: d, jenis: kindOf(d) };
  }
  if (!pilih) pilih = pilihHariIni(days, sessions, today, SESI_UTAMA_PER_MINGGU);
  if (!pilih) return null;

  const { day, jenis } = pilih;
  let dayItems = items.filter((i) => i.dayId === day.id).sort((a, b) => a.position - b.position);
  if (mode === "singkat") dayItems = shortModeExercises(dayItems);

  // Deload: volume ±60%. Ramadan: kurangi 1 set di gerakan non-inti yang >= 3 set. Keduanya tidak ditumpuk.
  const dasar = dayItems.map((i) => ({
    exerciseId: i.exercise.id,
    gantiDari: null as number | null,
    exercise: i.exercise,
    position: i.position,
    sets: settings.deload_aktif ? setDeload(i.sets) : settings.ramadan_aktif ? kurangiVolumeRamadan(i.sets, i.isCore) : i.sets,
    repMin: i.repMin,
    repMax: i.repMax,
  }));

  // Gerakan yang diganti di sesi hari ini (alat penuh). Pengganti mewarisi set dan rentang reps.
  let rencana = dasar;
  const { daftar, selesai } = await swapsUntukMenu(today, day.id);
  if (daftar.length > 0) {
    const semua = new Map((await loadExercises()).map((e) => [e.id, e]));
    rencana = terapkanGanti(dasar, daftar, selesai, (asal, ke, sets) => {
      const exercise = semua.get(ke);
      return exercise ? { ...asal, exerciseId: ke, gantiDari: asal.exerciseId, exercise, sets } : null;
    });
  }

  const history = await getHistory(
    rencana.map((i) => i.exercise.id),
    today,
  );
  const namaAsal = new Map<number, string>(dasar.map((i) => [i.exerciseId, i.exercise.name]));
  for (const i of rencana) namaAsal.set(i.exerciseId, i.exercise.name);
  const recovery = isRecovery(day);

  return {
    day,
    jenis,
    mode,
    recovery,
    pilihan: days,
    ramadan: settings.ramadan_aktif,
    deload: settings.deload_aktif,
    kardio: rekomendasiKardio({ mode, recovery, lajuBeratKg: laju, ramadan: settings.ramadan_aktif }),
    items: rencana.map((i) => ({
      exercise: i.exercise,
      position: i.position,
      sets: i.sets,
      repMin: i.repMin,
      repMax: i.repMax,
      gantiDari: i.gantiDari == null ? null : { id: i.gantiDari, name: namaAsal.get(i.gantiDari) ?? "gerakan lain" },
      target: targetGerakan(history.get(i.exercise.id) ?? [], i, i.exercise, today),
    })),
  };
}

/** Target beban dan reps satu gerakan untuk skema set tertentu. */
export function targetGerakan(riwayat: ExerciseSession[], skema: { sets: number; repMin: number; repMax: number }, exercise: ExerciseRow, today: string): Target {
  return computeTarget(riwayat, { sets: skema.sets, repMin: skema.repMin, repMax: skema.repMax }, exercise.increment_kg, today, { bodyweight: exercise.is_bodyweight });
}

export function targetLine(p: PlannedExercise): string {
  const reps = `${p.sets} × ${p.repMin}-${p.repMax}`;
  if (p.exercise.is_bodyweight) return `${reps} · berat badan sendiri, target ${p.target.reps} rep`;
  if (p.target.weightKg == null) return `${reps} · pilih beban sendiri`;
  return `${reps} · target ${fmtKg(p.target.weightKg)} kg × ${p.target.reps}`;
}

export function labelJenis(jenis: JenisHari): string {
  return jenis === "bonus" ? "bonus (variasi)" : "utama";
}

export function formatMenu(menu: TodayMenu, today: string, settings: Settings): string {
  const lines: string[] = [];
  lines.push(`🏋️ ${menu.day.name}${menu.mode === "singkat" ? " (versi singkat ±30 menit)" : ""}`);
  lines.push(`${namaHari(today)}, ${today} · menu ${labelJenis(menu.jenis)}`);
  lines.push("");
  menu.items.forEach((p, i) => {
    lines.push(`${i + 1}. ${p.exercise.name}`);
    lines.push(`   ${targetLine(p)}`);
    lines.push(`   ↳ ${p.target.note}`);
  });
  lines.push("");
  lines.push(`🚶 Kardio: ${menu.kardio.deskripsi}${menu.kardio.alasan ? ` (${menu.kardio.alasan})` : ""}`);
  lines.push("");
  lines.push(`🎯 Hari ini: ${fmtInt(settings.target_kcal)} kcal${menu.ramadan ? " (maintenance, mode Ramadan)" : ""} · protein ${settings.target_protein_g} g`);
  if (menu.deload) lines.push(`🔋 ${PANDUAN_DELOAD}`);
  if (menu.ramadan) lines.push(`🌙 ${SARAN_LATIHAN_RAMADAN}`);
  lines.push("");
  lines.push("Log set tinggal ketik, contoh: bench 60x10x3. Mau menu lain? Ketik /menu.");
  return lines.join("\n");
}

export function isWorkoutDay(today: string, settings: Settings): boolean {
  return settings.workout_days.includes(isoWeekday(today));
}

export { getSettings };
