// Hitungan nutrisi. AI cuma memperkirakan gizi per item; semua penjumlahan, pengali porsi,
// dan progres harian dihitung kode di sini.

export type ItemGizi = {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export type Total = { kcal: number; proteinG: number; carbsG: number; fatG: number };

export const PORTION_FACTORS = [0.5, 1, 1.5, 2] as const;

function r1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Jumlahkan item lalu kalikan pengali porsi (½, 1, 1½, 2). */
export function sumItems(items: ItemGizi[], factor = 1): Total {
  const f = clampFactor(factor);
  const t = items.reduce(
    (a, i) => ({
      kcal: a.kcal + i.kcal,
      proteinG: a.proteinG + i.proteinG,
      carbsG: a.carbsG + i.carbsG,
      fatG: a.fatG + i.fatG,
    }),
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
  return { kcal: r1(t.kcal * f), proteinG: r1(t.proteinG * f), carbsG: r1(t.carbsG * f), fatG: r1(t.fatG * f) };
}

export function clampFactor(f: number): number {
  if (!Number.isFinite(f)) return 1;
  return Math.min(4, Math.max(0.25, Math.round(f * 100) / 100));
}

/** Rentang kalori ikut diskalakan oleh pengali porsi. */
export function scaleRange(min: number | null, max: number | null, factor: number): { min: number | null; max: number | null } {
  const f = clampFactor(factor);
  return { min: min == null ? null : r1(min * f), max: max == null ? null : r1(max * f) };
}

export function persen(nilai: number, target: number): number {
  if (!(target > 0)) return 0;
  return Math.round((nilai / target) * 100);
}

/** Sisa protein/kalori ke target (0 kalau sudah lewat). */
export function sisa(nilai: number, target: number): number {
  return Math.max(0, r1(target - nilai));
}

export function labelFaktor(f: number): string {
  if (f === 0.5) return "½";
  if (f === 1.5) return "1½";
  return String(f).replace(".", ",");
}
