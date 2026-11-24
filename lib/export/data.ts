import { db, must } from "../supabase.ts";
import { todayWIB } from "../time.ts";
import { buatCsv } from "./csv.ts";

// Data untuk export CSV (dibuka di Google Sheets). Baca-saja.

export type JenisExport = "latihan" | "nutrisi" | "timbangan";
export const JENIS_VALID: JenisExport[] = ["latihan", "nutrisi", "timbangan"];

const wibJam = (iso: string) =>
  new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso)).replace(".", ":");

async function csvLatihan(): Promise<string> {
  const [days, sets] = await Promise.all([
    db().from("program_days").select("id,name").then((r) => must(r) as { id: number; name: string }[]),
    db()
      .from("workout_sets")
      .select("id,set_number,weight_kg,reps,rpe,is_warmup,exercises(name),workout_sessions(session_date,mode,energy,cardio_min,program_day_id,status)")
      .order("id")
      .limit(50000)
      .then(
        (r) =>
          must(r) as unknown as {
            id: number;
            set_number: number;
            weight_kg: number;
            reps: number;
            rpe: number | null;
            is_warmup: boolean;
            exercises: { name: string };
            workout_sessions: { session_date: string; mode: string; energy: number | null; cardio_min: number | null; program_day_id: number | null; status: string };
          }[],
      ),
  ]);
  const nama = new Map(days.map((d) => [d.id, d.name]));
  const rows = sets
    .sort((a, b) => (a.workout_sessions.session_date === b.workout_sessions.session_date ? a.id - b.id : a.workout_sessions.session_date < b.workout_sessions.session_date ? -1 : 1))
    .map((s) => [
      s.workout_sessions.session_date,
      (s.workout_sessions.program_day_id && nama.get(s.workout_sessions.program_day_id)) || "",
      s.workout_sessions.mode,
      s.workout_sessions.status,
      s.workout_sessions.energy,
      s.workout_sessions.cardio_min,
      s.exercises.name,
      s.set_number,
      s.weight_kg,
      s.reps,
      s.rpe,
      s.is_warmup ? "ya" : "tidak",
      s.is_warmup ? 0 : Math.round(s.weight_kg * s.reps * 100) / 100,
    ]);
  return buatCsv(
    ["tanggal", "program", "mode", "status_sesi", "energi_1_5", "kardio_menit", "gerakan", "set_ke", "beban_kg", "reps", "rpe", "pemanasan", "volume_kg"],
    rows,
  );
}

async function csvNutrisi(): Promise<string> {
  const meals = must(
    await db()
      .from("meals")
      .select("meal_date,eaten_at,description,source,status,portion_factor,total_kcal,protein_g,carbs_g,fat_g,kcal_min,kcal_max,confidence,meal_items(name,portion_g)")
      .order("meal_date")
      .order("eaten_at")
      .limit(20000),
  ) as unknown as {
    meal_date: string;
    eaten_at: string;
    description: string | null;
    source: string;
    status: string;
    portion_factor: number;
    total_kcal: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    kcal_min: number | null;
    kcal_max: number | null;
    confidence: string | null;
    meal_items: { name: string; portion_g: number | null }[];
  }[];
  return buatCsv(
    ["tanggal", "jam_wib", "deskripsi", "sumber", "status", "porsi_x", "kcal", "protein_g", "karbo_g", "lemak_g", "kcal_min", "kcal_max", "keyakinan", "item"],
    meals.map((m) => [
      m.meal_date,
      wibJam(m.eaten_at),
      m.description,
      m.source,
      m.status,
      m.portion_factor,
      m.total_kcal,
      m.protein_g,
      m.carbs_g,
      m.fat_g,
      m.kcal_min,
      m.kcal_max,
      m.confidence,
      m.meal_items.map((i) => (i.portion_g ? `${i.name} (${i.portion_g} g)` : i.name)).join("; "),
    ]),
  );
}

async function csvTimbangan(): Promise<string> {
  const rows = must(await db().from("body_measurements").select("*").order("measured_at").limit(20000)) as Record<string, unknown>[];
  return buatCsv(
    ["tanggal", "jam_wib", "berat_kg", "kondisi", "sumber", "body_fat_pct", "otot_kg", "muscle_score", "bmi", "muscle_quality", "visceral_fat", "tulang_kg", "air_pct", "bmr_kcal", "usia_metabolik", "catatan"],
    rows.map((r) => [
      todayWIB(new Date(String(r.measured_at))),
      wibJam(String(r.measured_at)),
      r.weight_kg,
      r.condition,
      r.source,
      r.body_fat_pct,
      r.muscle_mass_kg,
      r.muscle_score,
      r.bmi,
      r.muscle_quality,
      r.visceral_fat,
      r.bone_mass_kg,
      r.body_water_pct,
      r.bmr_kcal,
      r.metabolic_age,
      r.note,
    ]),
  );
}

export async function buatExport(jenis: JenisExport): Promise<string> {
  if (jenis === "latihan") return csvLatihan();
  if (jenis === "nutrisi") return csvNutrisi();
  return csvTimbangan();
}
