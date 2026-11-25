import type { ExerciseSession, Scheme, Target, WorkingSet } from "./types.ts";

// Aturan double progression (lihat CLAUDE.md bagian 6.3):
//  - Semua set mencapai batas atas reps (dan RPE <= 8 kalau diisi) -> naik beban.
//  - Belum -> beban sama, target +1 rep.
//  - Gagal capai batas bawah 2 sesi berturut-turut -> turun beban ~7,5%.
//  - Libur 7-13 hari -> ~90% beban terakhir. Libur >= 14 hari -> ~80%.

export const DELOAD_FACTOR = 0.925;
export const BREAK_SHORT_DAYS = 7;
export const BREAK_LONG_DAYS = 14;
export const BREAK_SHORT_FACTOR = 0.9;
export const BREAK_LONG_FACTOR = 0.8;
export const MAX_RPE_FOR_PROGRESS = 8;

function clean(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Tampilan berat ala Indonesia (koma desimal) untuk teks penjelasan. */
function kg(n: number): string {
  return String(clean(n)).replace(".", ",");
}

/**
 * Langkah beban terkecil di tombol +/- dan pembulatan: 1 kg. Barbel dan dumbbell di Fithub Tebet
 * kelipatan 2 kg, tapi cable machine naik per 1 kg, jadi tombolnya dibuat 1 kg buat semua gerakan.
 */
export const WEIGHT_GRID_KG = 1;

/** Langkah pembulatan dan tombol +/-: sekecil kenaikan gerakan itu, tapi nggak lebih besar dari WEIGHT_GRID_KG. */
export function roundingStep(incrementKg: number): number {
  return Math.min(incrementKg, WEIGHT_GRID_KG);
}

export function roundToStep(value: number, step: number): number {
  return clean(Math.round(value / step) * step);
}

/** Selisih hari antara dua tanggal "YYYY-MM-DD". */
export function daysBetween(from: string, to: string): number {
  const a = Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10));
  const b = Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

function topWeightSets(sets: WorkingSet[]): { weight: number; sets: WorkingSet[] } {
  const weight = Math.max(...sets.map((s) => s.weightKg));
  return { weight, sets: sets.filter((s) => s.weightKg === weight) };
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function hitTop(sets: WorkingSet[], scheme: Scheme): boolean {
  return (
    sets.length >= scheme.sets &&
    sets.every(
      (s) =>
        s.reps >= scheme.repMax &&
        (s.rpe == null || s.rpe <= MAX_RPE_FOR_PROGRESS),
    )
  );
}

/** Sesi dianggap gagal kalau lebih dari separuh set di bawah batas bawah reps. */
function failedSession(sets: WorkingSet[], scheme: Scheme): boolean {
  const below = sets.filter((s) => s.reps < scheme.repMin).length;
  return below * 2 > sets.length;
}

/** Turunkan beban: hasilnya selalu lebih ringan dari beban awal (kalau masih bisa). */
function lighter(weight: number, factor: number, step: number): number {
  let w = roundToStep(weight * factor, step);
  if (w >= weight) w = weight - step;
  return Math.max(step, clean(w));
}

/**
 * Gerakan bodyweight (hanging leg raise, ab wheel, sit-up): progres lewat reps, bukan beban.
 * Mulai dari berat badan sendiri; kalau semua set sudah di batas atas reps, naikin tantangannya
 * (tempo lambat, tahan 1-2 detik di atas, atau tambah beban kecil) sambil reps tetap di batas atas.
 */
function computeTargetBodyweight(history: ExerciseSession[], scheme: Scheme, today: string): Target {
  const sessions = history
    .filter((s) => s.sets.length > 0)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  if (sessions.length === 0) {
    return {
      weightKg: 0,
      reps: scheme.repMin,
      sets: scheme.sets,
      reason: "belum_ada_data",
      note: "Pakai berat badan sendiri (beban 0). Berhenti 1-2 rep sebelum form berantakan.",
    };
  }

  const last = sessions[0];
  const minReps = Math.min(...last.sets.map((s) => s.reps));
  const days = daysBetween(last.date, today);

  if (days >= BREAK_SHORT_DAYS) {
    return {
      weightKg: 0,
      reps: clamp(minReps, scheme.repMin, scheme.repMax),
      sets: scheme.sets,
      reason: days >= BREAK_LONG_DAYS ? "balik_libur_lama" : "balik_libur_sebentar",
      note: `Udah ${days} hari nggak latihan gerakan ini. Mulai santai dulu di ${clamp(minReps, scheme.repMin, scheme.repMax)} rep.`,
    };
  }

  const semuaDiAtas = last.sets.length >= scheme.sets && last.sets.every((s) => s.reps >= scheme.repMax);
  if (semuaDiAtas) {
    return {
      weightKg: 0,
      reps: scheme.repMax,
      sets: scheme.sets,
      reason: "tahan_beban",
      note: `Semua set udah ${scheme.repMax} rep. Naikin tantangannya: tempo turun 3 detik, tahan 1-2 detik di puncak, atau tambah beban kecil.`,
    };
  }

  const reps = clamp(minReps + 1, scheme.repMin, scheme.repMax);
  return {
    weightKg: 0,
    reps,
    sets: scheme.sets,
    reason: "tambah_rep",
    note: `Target ${reps} rep tiap set (kemarin terendah ${minReps}).`,
  };
}

/**
 * Hitung target beban dan reps untuk sesi berikutnya.
 * @param history riwayat gerakan ini (working set saja), sesi terbaru dulu
 * @param incrementKg langkah naik beban gerakan ini
 * @param today tanggal hari ini "YYYY-MM-DD" (WIB)
 */
export function computeTarget(
  history: ExerciseSession[],
  scheme: Scheme,
  incrementKg: number,
  today: string,
  opts: { bodyweight?: boolean } = {},
): Target {
  if (opts.bodyweight) return computeTargetBodyweight(history, scheme, today);
  const sessions = history
    .filter((s) => s.sets.length > 0)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  if (sessions.length === 0) {
    return {
      weightKg: null,
      reps: scheme.repMin,
      sets: scheme.sets,
      reason: "belum_ada_data",
      note: "Belum ada catatan. Pilih beban yang kerasa sisa 2-3 rep di set terakhir.",
    };
  }

  const step = roundingStep(incrementKg);
  const last = sessions[0];
  const top = topWeightSets(last.sets);
  const minReps = Math.min(...top.sets.map((s) => s.reps));
  const days = daysBetween(last.date, today);

  // 1. Habis libur: turunin dulu, naik bertahap setelahnya.
  if (days >= BREAK_SHORT_DAYS) {
    const long = days >= BREAK_LONG_DAYS;
    const factor = long ? BREAK_LONG_FACTOR : BREAK_SHORT_FACTOR;
    const weight = lighter(top.weight, factor, step);
    return {
      weightKg: weight,
      reps: clamp(minReps, scheme.repMin, scheme.repMax),
      sets: scheme.sets,
      reason: long ? "balik_libur_lama" : "balik_libur_sebentar",
      note: `Udah ${days} hari nggak latihan gerakan ini. Mulai ±${Math.round(factor * 100)}% dari ${kg(top.weight)} kg, nanti naik bertahap.`,
    };
  }

  // 2. Gagal capai batas bawah 2 sesi berturut-turut: turunin beban.
  if (
    sessions.length >= 2 &&
    failedSession(top.sets, scheme) &&
    failedSession(topWeightSets(sessions[1].sets).sets, scheme)
  ) {
    return {
      weightKg: lighter(top.weight, DELOAD_FACTOR, step),
      reps: scheme.repMin,
      sets: scheme.sets,
      reason: "turun_beban",
      note: `2 sesi berturut-turut belum nyampe ${scheme.repMin} rep di ${kg(top.weight)} kg. Turun dulu biar tekniknya rapi, nanti naik lagi.`,
    };
  }

  // 3. Semua set di batas atas: naik beban.
  if (hitTop(top.sets, scheme)) {
    return {
      weightKg: clean(top.weight + incrementKg),
      reps: scheme.repMin,
      sets: scheme.sets,
      reason: "naik_beban",
      note: `Semua set udah ${scheme.repMax} rep di ${kg(top.weight)} kg. Naik ke ${kg(top.weight + incrementKg)} kg.`,
    };
  }

  // 4. Belum: beban sama, tambah 1 rep.
  const allAtTopReps = top.sets.every((s) => s.reps >= scheme.repMax);
  const reps = clamp(minReps + 1, scheme.repMin, scheme.repMax);
  const incomplete = top.sets.length < scheme.sets;
  return {
    weightKg: top.weight,
    reps,
    sets: scheme.sets,
    reason: allAtTopReps ? "tahan_beban" : "tambah_rep",
    note: allAtTopReps
      ? incomplete
        ? `Rep udah di batas atas tapi setnya baru ${top.sets.length} dari ${scheme.sets}. Lengkapin dulu di ${kg(top.weight)} kg.`
        : `Rep udah di batas atas tapi RPE masih tinggi. Tahan di ${kg(top.weight)} kg sampai kerasa lebih ringan.`
      : `Tahan di ${kg(top.weight)} kg, target ${reps} rep tiap set (kemarin terendah ${minReps}).`,
  };
}
