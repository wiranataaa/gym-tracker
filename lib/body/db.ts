import { db, must } from "../supabase.ts";
import { awalMinggu } from "../report/hitung.ts";
import { todayWIB } from "../time.ts";
import { dailyValues, daysBetween, weeklyRate } from "./trend.ts";

export type Kondisi = "pagi_puasa" | "sebelum_latihan" | "setelah_makan" | "setelah_olahraga" | "lainnya";

/** Kondisi yang dianggap standar (bisa dibandingkan antar minggu). */
export const KONDISI_STANDAR: Kondisi[] = ["pagi_puasa", "sebelum_latihan"];
export const isStandar = (k: Kondisi) => KONDISI_STANDAR.includes(k);

export const LABEL_KONDISI: Record<Kondisi, string> = {
  sebelum_latihan: "sebelum latihan (gym)",
  pagi_puasa: "pagi, belum makan",
  setelah_olahraga: "setelah latihan",
  setelah_makan: "setelah makan",
  lainnya: "kondisi lain",
};

export type Measurement = {
  id: number;
  measuredAt: string;
  date: string; // tanggal WIB
  weightKg: number;
  condition: Kondisi;
  source: "manual" | "telegram" | "foto_tanita";
  bodyFatPct: number | null;
  muscleMassKg: number | null;
  visceralFat: number | null;
  boneMassKg: number | null;
  bodyWaterPct: number | null;
  bmrKcal: number | null;
  metabolicAge: number | null;
};

type Row = {
  id: number;
  measured_at: string;
  weight_kg: number;
  condition: Kondisi;
  source: Measurement["source"];
  body_fat_pct: number | null;
  muscle_mass_kg: number | null;
  visceral_fat: number | null;
  bone_mass_kg: number | null;
  body_water_pct: number | null;
  bmr_kcal: number | null;
  metabolic_age: number | null;
};

const COLS =
  "id,measured_at,weight_kg,condition,source,body_fat_pct,muscle_mass_kg,visceral_fat,bone_mass_kg,body_water_pct,bmr_kcal,metabolic_age";

/** Terbaru dulu. */
export async function listMeasurements(limit = 400): Promise<Measurement[]> {
  const rows = must(
    await db().from("body_measurements").select(COLS).order("measured_at", { ascending: false }).limit(limit),
  ) as Row[];
  return rows.map((r) => ({
    id: r.id,
    measuredAt: r.measured_at,
    date: todayWIB(new Date(r.measured_at)),
    weightKg: Number(r.weight_kg),
    condition: r.condition,
    source: r.source,
    bodyFatPct: r.body_fat_pct,
    muscleMassKg: r.muscle_mass_kg,
    visceralFat: r.visceral_fat,
    boneMassKg: r.bone_mass_kg,
    bodyWaterPct: r.body_water_pct,
    bmrKcal: r.bmr_kcal,
    metabolicAge: r.metabolic_age,
  }));
}

export async function insertMeasurement(weightKg: number, condition: Kondisi, source: Measurement["source"] = "manual"): Promise<void> {
  must(
    await db().from("body_measurements").insert({
      measured_at: new Date().toISOString(),
      weight_kg: weightKg,
      condition,
      source,
    }),
  );
}

/** Laju berat (kg/minggu) dari rata-rata 7 hari terakhir vs 7 hari sebelumnya; null kalau data belum cukup. */
export async function lajuBeratTerakhir(today: string): Promise<number | null> {
  const list = await listMeasurements(120);
  return weeklyRate(
    dailyValues(list.map((m) => ({ date: m.date, weightKg: m.weightKg }))),
    today,
  );
}

/** Info buat pengingat timbang: sudah timbang minggu ini (Senin-Minggu)? dan berapa hari sejak yang terakhir. */
export async function statusTimbang(today: string): Promise<{ sudahMingguIni: boolean; hariSejak: number | null }> {
  const terakhir = (await listMeasurements(1))[0];
  if (!terakhir) return { sudahMingguIni: false, hariSejak: null };
  return {
    sudahMingguIni: terakhir.date >= awalMinggu(today),
    hariSejak: daysBetween(terakhir.date, today),
  };
}

export async function removeMeasurement(id: number): Promise<void> {
  must(await db().from("body_measurements").delete().eq("id", id));
}

export async function getTargets(): Promise<{ targetKg: number; stretchKg: number; lebaranDate: string; ramadanStart: string }> {
  const s = must(
    await db().from("settings").select("target_weight_kg,stretch_target_kg,lebaran_date,ramadan_start").eq("id", 1).single(),
  ) as { target_weight_kg: number; stretch_target_kg: number; lebaran_date: string; ramadan_start: string };
  return {
    targetKg: Number(s.target_weight_kg),
    stretchKg: Number(s.stretch_target_kg),
    lebaranDate: s.lebaran_date,
    ramadanStart: s.ramadan_start,
  };
}
