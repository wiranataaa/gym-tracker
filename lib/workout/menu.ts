import { computeTarget } from "../program/progression.ts";
import { nextProgramDay, type ProgramDay } from "../program/queue.ts";
import { shortModeExercises } from "../program/shortMode.ts";
import type { Target } from "../program/types.ts";
import { fmtInt, fmtKg, isoWeekday, namaHari } from "../time.ts";
import { getHistory, getSettings, loadProgram, loadRecentSessions, type ExerciseRow, type Settings } from "./db.ts";

export type PlannedExercise = {
  exercise: ExerciseRow;
  position: number;
  sets: number;
  repMin: number;
  repMax: number;
  target: Target;
};

export type TodayMenu = {
  day: ProgramDay;
  mode: "normal" | "singkat";
  items: PlannedExercise[];
};

/** Susun menu hari ini: hari berikutnya di antrean + target beban hasil hitungan kode. */
export async function buildMenu(today: string, mode: "normal" | "singkat"): Promise<TodayMenu | null> {
  const [{ days, items }, sessions] = await Promise.all([loadProgram(), loadRecentSessions()]);
  const day = nextProgramDay(days, sessions);
  if (!day) return null;

  let dayItems = items.filter((i) => i.dayId === day.id).sort((a, b) => a.position - b.position);
  if (mode === "singkat") dayItems = shortModeExercises(dayItems);

  const history = await getHistory(
    dayItems.map((i) => i.exercise.id),
    today,
  );

  return {
    day,
    mode,
    items: dayItems.map((i) => ({
      exercise: i.exercise,
      position: i.position,
      sets: i.sets,
      repMin: i.repMin,
      repMax: i.repMax,
      target: computeTarget(
        history.get(i.exercise.id) ?? [],
        { sets: i.sets, repMin: i.repMin, repMax: i.repMax },
        i.exercise.increment_kg,
        today,
      ),
    })),
  };
}

export function targetLine(p: PlannedExercise): string {
  const reps = `${p.sets} × ${p.repMin}-${p.repMax}`;
  if (p.target.weightKg == null) return `${reps} · pilih beban sendiri`;
  return `${reps} · target ${fmtKg(p.target.weightKg)} kg × ${p.target.reps}`;
}

export function formatMenu(menu: TodayMenu, today: string, settings: Settings): string {
  const lines: string[] = [];
  lines.push(`🏋️ ${menu.day.name}${menu.mode === "singkat" ? " (versi singkat ±30 menit)" : ""}`);
  lines.push(`${namaHari(today)}, ${today}`);
  lines.push("");
  menu.items.forEach((p, i) => {
    lines.push(`${i + 1}. ${p.exercise.name}`);
    lines.push(`   ${targetLine(p)}`);
    lines.push(`   ↳ ${p.target.note}`);
  });
  lines.push("");
  lines.push(`🎯 Hari ini: ${fmtInt(settings.target_kcal)} kcal · protein ${settings.target_protein_g} g`);
  lines.push("");
  lines.push("Log set tinggal ketik, contoh: bench 60x10x3");
  return lines.join("\n");
}

export function isWorkoutDay(today: string, settings: Settings): boolean {
  return settings.workout_days.includes(isoWeekday(today));
}

export { getSettings };
