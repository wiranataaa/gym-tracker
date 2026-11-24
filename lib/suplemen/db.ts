import { db, must } from "../supabase.ts";
import { todayWIB } from "../time.ts";

// Suplemen: creatine (checklist harian, tanpa kalori) dan whey (dihitung ke kalori/protein lewat tabel meals).

export type Suplemen = {
  id: number;
  name: string;
  doseDesc: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  aktif: boolean;
  pengingat: boolean;
};

type Row = {
  id: number;
  name: string;
  dose_desc: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  aktif: boolean;
  pengingat: boolean;
};

const COLS = "id,name,dose_desc,kcal,protein_g,carbs_g,fat_g,aktif,pengingat";

const toSup = (r: Row): Suplemen => ({
  id: r.id,
  name: r.name,
  doseDesc: r.dose_desc,
  kcal: Number(r.kcal),
  proteinG: Number(r.protein_g),
  carbsG: Number(r.carbs_g),
  fatG: Number(r.fat_g),
  aktif: r.aktif,
  pengingat: r.pengingat,
});

/** Kalau tabelnya belum ada (SQL 006 belum dijalankan), anggap kosong supaya halaman lain tetap jalan. */
export async function listSuplemen(hanyaAktif = true): Promise<Suplemen[]> {
  let q = db().from("supplements").select(COLS).order("id");
  if (hanyaAktif) q = q.eq("aktif", true);
  const { data, error } = await q;
  if (error) return [];
  return (data as Row[]).map(toSup);
}

export async function getSuplemen(id: number): Promise<Suplemen | null> {
  const { data, error } = await db().from("supplements").select(COLS).eq("id", id).maybeSingle();
  if (error || !data) return null;
  return toSup(data as Row);
}

/** Berapa kali tiap suplemen dicatat pada tanggal itu (kunci = supplement_id). */
export async function hitungHariIni(date: string): Promise<Map<number, number>> {
  const { data, error } = await db().from("supplement_logs").select("supplement_id").eq("log_date", date);
  const m = new Map<number, number>();
  if (error) return m;
  for (const r of data as { supplement_id: number }[]) m.set(r.supplement_id, (m.get(r.supplement_id) ?? 0) + 1);
  return m;
}

/** Catat satu dosis. Yang punya kalori/protein (whey) ikut masuk ke makan hari itu, jadi terhitung di progres. */
export async function catatSuplemen(suplemenId: number, date: string = todayWIB()): Promise<{ sup: Suplemen; jumlahHariIni: number } | null> {
  const sup = await getSuplemen(suplemenId);
  if (!sup) return null;

  let mealId: number | null = null;
  if (sup.kcal > 0 || sup.proteinG > 0) {
    const meal = must(
      await db()
        .from("meals")
        .insert({
          eaten_at: new Date().toISOString(),
          meal_date: date,
          source: "manual",
          description: `${sup.name} (${sup.doseDesc})`,
          total_kcal: sup.kcal,
          protein_g: sup.proteinG,
          carbs_g: sup.carbsG,
          fat_g: sup.fatG,
          confidence: "tinggi",
          status: "tersimpan",
          portion_factor: 1,
        })
        .select("id")
        .single(),
    ) as { id: number };
    mealId = meal.id;
    must(
      await db().from("meal_items").insert({
        meal_id: mealId,
        name: `${sup.name} — ${sup.doseDesc}`,
        kcal: sup.kcal,
        protein_g: sup.proteinG,
        carbs_g: sup.carbsG,
        fat_g: sup.fatG,
      }),
    );
  }

  must(await db().from("supplement_logs").insert({ log_date: date, supplement_id: suplemenId, meal_id: mealId }));
  const hitung = (await hitungHariIni(date)).get(suplemenId) ?? 1;
  return { sup, jumlahHariIni: hitung };
}

/** Batalkan dosis terakhir hari itu (dan makan yang ikut tercatat). */
export async function batalSuplemen(suplemenId: number, date: string = todayWIB()): Promise<boolean> {
  const { data } = await db()
    .from("supplement_logs")
    .select("id,meal_id")
    .eq("supplement_id", suplemenId)
    .eq("log_date", date)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  const log = data as { id: number; meal_id: number | null } | null;
  if (!log) return false;
  if (log.meal_id) must(await db().from("meals").delete().eq("id", log.meal_id));
  must(await db().from("supplement_logs").delete().eq("id", log.id));
  return true;
}

export async function ubahSuplemen(
  id: number,
  patch: Partial<{ dose_desc: string; kcal: number; protein_g: number; carbs_g: number; fat_g: number; aktif: boolean; pengingat: boolean }>,
): Promise<void> {
  must(await db().from("supplements").update(patch).eq("id", id));
}

/** Suplemen yang diminta diingatkan dan belum dicatat hari ini. */
export async function belumDiminum(date: string = todayWIB()): Promise<Suplemen[]> {
  const [semua, hitung] = await Promise.all([listSuplemen(true), hitungHariIni(date)]);
  return semua.filter((s) => s.pengingat && !hitung.get(s.id));
}
