// Pratinjau latihan berikutnya (biar tahu menu besok walaupun latihan hari ini baru selesai).
// Menu dan targetnya dihitung dengan cara yang sama persis dengan menu hari-H.

import type { Settings } from "./db.ts";
import { hariLatihanBerikutnya, labelKapan } from "./jadwal.ts";
import { buildMenu, targetLine } from "./menu.ts";

export type Pratinjau = {
  tanggal: string;
  /** "Besok (Jumat)" atau "Senin, 30 Nov" */
  kapan: string;
  dayName: string;
  gerakan: { name: string; target: string }[];
  kardioMenit: number;
};

export async function pratinjauBerikutnya(today: string, settings: Pick<Settings, "workout_days">): Promise<Pratinjau | null> {
  const tanggal = hariLatihanBerikutnya(today, settings.workout_days);
  const menu = await buildMenu(tanggal, "normal");
  if (!menu) return null;
  return {
    tanggal,
    kapan: labelKapan(today, tanggal),
    dayName: menu.day.name,
    gerakan: menu.items.map((p) => ({ name: p.exercise.name, target: targetLine(p) })),
    kardioMenit: menu.kardio.menit,
  };
}
