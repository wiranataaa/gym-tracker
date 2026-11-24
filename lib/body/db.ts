import { db, must } from "../supabase.ts";
import { awalMinggu } from "../report/hitung.ts";
import { todayWIB } from "../time.ts";
import { dailyValues, daysBetween, weeklyRate } from "./trend.ts";
import { waktuUkur, type KomposisiBaca } from "./tanitaValid.ts";

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

/** Tinggi badan (cm) dari pengaturan, dipakai buat memeriksa BMI hasil baca Tanita. */
export async function tinggiCm(): Promise<number> {
  const r = must(await db().from("settings").select("height_cm").eq("id", 1).single()) as { height_cm: number };
  return Number(r.height_cm);
}

/**
 * Simpan hasil komposisi badan lengkap. Mengembalikan duplikat=true (tanpa menyimpan)
 * kalau sudah ada timbangan di waktu yang sama.
 */
export async function simpanKomposisi(
  d: KomposisiBaca,
  kondisi: Kondisi,
  source: Measurement["source"] = "foto_tanita",
): Promise<{ id: number | null; duplikat: boolean; measuredAt: string }> {
  if (d.beratKg == null) throw new Error("Berat wajib ada");
  const measuredAt = waktuUkur(d);
  const awal = new Date(new Date(measuredAt).getTime() - 60_000).toISOString();
  const akhir = new Date(new Date(measuredAt).getTime() + 60_000).toISOString();
  const ada = must(await db().from("body_measurements").select("id").gte("measured_at", awal).lte("measured_at", akhir).limit(1)) as { id: number }[];
  if (ada.length > 0) return { id: ada[0].id, duplikat: true, measuredAt };

  const row = must(
    await db()
      .from("body_measurements")
      .insert({
        measured_at: measuredAt,
        weight_kg: d.beratKg,
        body_fat_pct: d.bodyFatPct,
        muscle_mass_kg: d.muscleMassKg,
        muscle_score: d.muscleScore,
        bmi: d.bmi,
        muscle_quality: d.muscleQuality,
        visceral_fat: d.visceralFat,
        bone_mass_kg: d.boneMassKg,
        body_water_pct: d.bodyWaterPct,
        bmr_kcal: d.bmrKcal,
        metabolic_age: d.metabolicAge,
        condition: kondisi,
        source,
      })
      .select("id")
      .single(),
  ) as { id: number };
  return { id: row.id, duplikat: false, measuredAt };
}

export async function buatDraftTanita(data: KomposisiBaca, kondisi: Kondisi): Promise<number> {
  const r = must(await db().from("tanita_draft").insert({ data, kondisi }).select("id").single()) as { id: number };
  return r.id;
}

export async function ambilDraftTanita(id: number): Promise<{ data: KomposisiBaca; kondisi: Kondisi } | null> {
  const r = must(await db().from("tanita_draft").select("data,kondisi").eq("id", id).maybeSingle()) as { data: KomposisiBaca; kondisi: Kondisi } | null;
  return r;
}

export async function hapusDraftTanita(id: number): Promise<void> {
  must(await db().from("tanita_draft").delete().eq("id", id));
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
