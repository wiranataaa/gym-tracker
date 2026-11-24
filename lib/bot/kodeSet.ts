// Kode ringkas buat tombol konfirmasi set hasil tebakan AI. Telegram membatasi callback_data 64 byte,
// jadi seluruh isi set dikodekan di dalamnya (tanpa perlu menyimpan draft di database).
//   ft:{id gerakan}:{beban}:{reps dipisah -}:{rpe atau 0}:{1 kalau pemanasan}

export type SetKode = { exerciseId: number; bebanKg: number; reps: number[]; rpe: number | null; pemanasan: boolean };

export function kodeSet(s: SetKode): string {
  return `ft:${s.exerciseId}:${s.bebanKg}:${s.reps.join("-")}:${s.rpe ?? 0}:${s.pemanasan ? 1 : 0}`;
}

export function bacaKodeSet(data: string): SetKode | null {
  const m = data.match(/^ft:(\d+):(\d+(?:\.\d+)?):(\d+(?:-\d+)*):(\d+(?:\.\d+)?):([01])$/);
  if (!m) return null;
  const reps = m[3].split("-").map(Number);
  const bebanKg = Number(m[2]);
  const rpe = Number(m[4]);
  if (reps.length > 10 || reps.some((r) => r < 1 || r > 100) || bebanKg > 500 || rpe > 10) return null;
  return { exerciseId: Number(m[1]), bebanKg, reps, rpe: rpe === 0 ? null : rpe, pemanasan: m[5] === "1" };
}
