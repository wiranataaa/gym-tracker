// Deteksi PR (personal record): estimasi 1RM (Epley) dan reps terbanyak di beban yang sama.

export type SimpleSet = { weightKg: number; reps: number };

export function estimate1RM(weightKg: number, reps: number): number {
  if (reps <= 1) return weightKg;
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}

export type PRResult = {
  /** PR estimasi 1RM */
  e1rm: boolean;
  /** PR reps terbanyak di beban yang sama */
  reps: boolean;
  e1rmValue: number;
  previousBestE1rm: number | null;
};

/**
 * @param previousSets semua working set sebelumnya untuk gerakan ini (tanpa set yang baru)
 * Set pertama sepanjang masa bukan PR (belum ada pembanding).
 */
export function detectPR(newSet: SimpleSet, previousSets: SimpleSet[]): PRResult {
  const e1rmValue = estimate1RM(newSet.weightKg, newSet.reps);
  if (previousSets.length === 0) {
    return { e1rm: false, reps: false, e1rmValue, previousBestE1rm: null };
  }

  const previousBestE1rm = Math.max(
    ...previousSets.map((s) => estimate1RM(s.weightKg, s.reps)),
  );
  const sameWeight = previousSets.filter((s) => s.weightKg === newSet.weightKg);
  const bestRepsAtWeight = sameWeight.length
    ? Math.max(...sameWeight.map((s) => s.reps))
    : null;

  return {
    e1rm: e1rmValue > previousBestE1rm,
    reps: bestRepsAtWeight != null && newSet.reps > bestRepsAtWeight,
    e1rmValue,
    previousBestE1rm,
  };
}
