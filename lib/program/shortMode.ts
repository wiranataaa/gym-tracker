// Mode singkat (hari capek): potong menu ke 2-3 gerakan compound inti.
// Tetap dicatat sebagai latihan supaya Nata tetap datang walau energi rendah.

export const SHORT_MODE_MAX_EXERCISES = 3;

export function shortModeExercises<T extends { isCore: boolean; position: number }>(
  items: T[],
): T[] {
  const ordered = [...items].sort((a, b) => a.position - b.position);
  const core = ordered.filter((i) => i.isCore);
  const picked = core.length >= 2 ? core : ordered;
  return picked.slice(0, SHORT_MODE_MAX_EXERCISES);
}
