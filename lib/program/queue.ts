// Sistem antrean, bukan kalender: menu berikutnya = hari setelah sesi
// TERAKHIR YANG SELESAI di urutan program. Bolos/skip nggak majuin antrean.

export type ProgramDay = { id: number; position: number; name: string };

export type SessionLite = {
  programDayId: number | null;
  status: "berjalan" | "selesai" | "dilewati";
  startedAt: string; // ISO timestamp
};

export function nextProgramDay(
  days: ProgramDay[],
  sessions: SessionLite[],
): ProgramDay | null {
  if (days.length === 0) return null;
  const ordered = [...days].sort((a, b) => a.position - b.position);

  const lastDone = sessions
    .filter((s) => s.status === "selesai" && s.programDayId != null)
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : a.startedAt > b.startedAt ? -1 : 0))[0];

  if (!lastDone) return ordered[0];

  const idx = ordered.findIndex((d) => d.id === lastDone.programDayId);
  if (idx < 0) return ordered[0];
  return ordered[(idx + 1) % ordered.length];
}
