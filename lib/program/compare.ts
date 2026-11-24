// Banding set terbaik sesi ini dengan sesi sebelumnya (dipakai kesimpulan dan rekap).

export type SetBaik = { weightKg: number; reps: number };

export type Banding = "pertama" | "beban_naik" | "rep_naik" | "sama" | "rep_turun" | "lebih_ringan";

export function setTerbaik(sets: SetBaik[]): SetBaik {
  const w = Math.max(...sets.map((s) => s.weightKg));
  return { weightKg: w, reps: Math.max(...sets.filter((s) => s.weightKg === w).map((s) => s.reps)) };
}

export function bandingkan(prev: SetBaik | null, cur: SetBaik): Banding {
  if (!prev) return "pertama";
  if (cur.weightKg > prev.weightKg) return "beban_naik";
  if (cur.weightKg < prev.weightKg) return "lebih_ringan";
  if (cur.reps > prev.reps) return "rep_naik";
  if (cur.reps < prev.reps) return "rep_turun";
  return "sama";
}
