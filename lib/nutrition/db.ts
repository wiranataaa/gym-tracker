import { randomUUID } from "node:crypto";
import type { EstimasiData } from "../ai/nutrition.ts";
import { db, must } from "../supabase.ts";
import { addDays, todayWIB } from "../time.ts";
import { scaleRange, sumItems } from "./calc.ts";

const BUCKET = "meal-photos";

export type MealItem = {
  id: number;
  name: string;
  portionG: number | null;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  note: string | null;
};

export type Meal = {
  id: number;
  eatenAt: string;
  date: string;
  source: "foto" | "teks" | "favorit" | "manual";
  description: string | null;
  photoPath: string | null;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  kcalMin: number | null;
  kcalMax: number | null;
  confidence: "rendah" | "sedang" | "tinggi" | null;
  status: "draft" | "tersimpan";
  factor: number;
  items: MealItem[];
};

type MealRow = {
  id: number;
  eaten_at: string;
  meal_date: string;
  source: Meal["source"];
  description: string | null;
  photo_path: string | null;
  total_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  kcal_min: number | null;
  kcal_max: number | null;
  confidence: Meal["confidence"];
  status: Meal["status"];
  portion_factor: number;
  meal_items?: {
    id: number;
    name: string;
    portion_g: number | null;
    kcal: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    note: string | null;
  }[];
};

const MEAL_COLS =
  "id,eaten_at,meal_date,source,description,photo_path,total_kcal,protein_g,carbs_g,fat_g,kcal_min,kcal_max,confidence,status,portion_factor,meal_items(id,name,portion_g,kcal,protein_g,carbs_g,fat_g,note)";

function toMeal(r: MealRow): Meal {
  return {
    id: r.id,
    eatenAt: r.eaten_at,
    date: r.meal_date,
    source: r.source,
    description: r.description,
    photoPath: r.photo_path,
    kcal: Number(r.total_kcal),
    proteinG: Number(r.protein_g),
    carbsG: Number(r.carbs_g),
    fatG: Number(r.fat_g),
    kcalMin: r.kcal_min == null ? null : Number(r.kcal_min),
    kcalMax: r.kcal_max == null ? null : Number(r.kcal_max),
    confidence: r.confidence,
    status: r.status,
    factor: Number(r.portion_factor),
    items: (r.meal_items ?? [])
      .sort((a, b) => a.id - b.id)
      .map((i) => ({
        id: i.id,
        name: i.name,
        portionG: i.portion_g == null ? null : Number(i.portion_g),
        kcal: Number(i.kcal),
        proteinG: Number(i.protein_g),
        carbsG: Number(i.carbs_g),
        fatG: Number(i.fat_g),
        note: i.note,
      })),
  };
}

// ---------- Foto ----------

export async function uploadPhoto(bytes: Uint8Array, contentType: string): Promise<string> {
  const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  const d = todayWIB();
  const path = `${d.slice(0, 4)}/${d.slice(5, 7)}/${randomUUID()}.${ext}`;
  const { error } = await db().storage.from(BUCKET).upload(path, bytes, { contentType, upsert: false });
  if (error) throw new Error(`Upload foto gagal: ${error.message}`);
  return path;
}

export async function signedPhotoUrls(paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const list = [...new Set(paths.filter(Boolean))];
  if (list.length === 0) return out;
  const { data } = await db().storage.from(BUCKET).createSignedUrls(list, 3600);
  for (const d of data ?? []) if (d.path && d.signedUrl) out.set(d.path, d.signedUrl);
  return out;
}

// ---------- Makan ----------

/** Simpan hasil AI sebagai draft (belum masuk hitungan harian sampai disimpan). */
export async function removePhoto(path: string | null): Promise<void> {
  if (path) await db().storage.from(BUCKET).remove([path]);
}

export async function createDraft(args: {
  source: "foto" | "teks";
  data: EstimasiData;
  photoPath?: string | null;
  aiModel: string;
  /** tanggal WIB "YYYY-MM-DD"; default hari ini */
  date?: string;
}): Promise<Meal> {
  const { data } = args;
  const items = data.item.map((i) => ({
    kcal: i.kcal,
    proteinG: i.protein_g,
    carbsG: i.karbo_g,
    fatG: i.lemak_g,
  }));
  const total = sumItems(items, 1);

  // Draft yang nggak pernah disimpan dibersihkan setelah 2 hari
  const cutoff = new Date(Date.now() - 2 * 86_400_000).toISOString();
  await db().from("meals").delete().eq("status", "draft").lt("created_at", cutoff);

  const row = must(
    await db()
      .from("meals")
      .insert({
        eaten_at: new Date().toISOString(),
        meal_date: args.date ?? todayWIB(),
        source: args.source,
        description: data.ringkasan,
        photo_path: args.photoPath ?? null,
        total_kcal: total.kcal,
        protein_g: total.proteinG,
        carbs_g: total.carbsG,
        fat_g: total.fatG,
        kcal_min: data.kcal_min,
        kcal_max: data.kcal_max,
        confidence: data.keyakinan,
        status: "draft",
        portion_factor: 1,
        ai_raw: { model: args.aiModel, ...data },
      })
      .select("id")
      .single(),
  ) as { id: number };

  if (data.item.length > 0) {
    must(
      await db()
        .from("meal_items")
        .insert(
          data.item.map((i) => ({
            meal_id: row.id,
            name: i.nama,
            portion_g: i.porsi_g,
            kcal: i.kcal,
            protein_g: i.protein_g,
            carbs_g: i.karbo_g,
            fat_g: i.lemak_g,
            note: i.catatan || null,
          })),
        ),
    );
  }
  return (await getMeal(row.id))!;
}

export async function getMeal(id: number): Promise<Meal | null> {
  const r = must(await db().from("meals").select(MEAL_COLS).eq("id", id).maybeSingle()) as MealRow | null;
  return r ? toMeal(r) : null;
}

/** Semua makan pada satu tanggal (draft + tersimpan), urut waktu. */
export async function listMeals(date: string): Promise<Meal[]> {
  const rows = must(
    await db().from("meals").select(MEAL_COLS).eq("meal_date", date).order("eaten_at", { ascending: true }),
  ) as MealRow[];
  return rows.map(toMeal);
}

/** Total harian: HANYA yang sudah disimpan. */
export async function dayTotals(date: string): Promise<{ kcal: number; proteinG: number; carbsG: number; fatG: number; count: number }> {
  const rows = must(
    await db().from("meals").select("total_kcal,protein_g,carbs_g,fat_g").eq("meal_date", date).eq("status", "tersimpan"),
  ) as { total_kcal: number; protein_g: number; carbs_g: number; fat_g: number }[];
  const r1 = (n: number) => Math.round(n * 10) / 10;
  return {
    kcal: r1(rows.reduce((a, r) => a + Number(r.total_kcal), 0)),
    proteinG: r1(rows.reduce((a, r) => a + Number(r.protein_g), 0)),
    carbsG: r1(rows.reduce((a, r) => a + Number(r.carbs_g), 0)),
    fatG: r1(rows.reduce((a, r) => a + Number(r.fat_g), 0)),
    count: rows.length,
  };
}

/** Rata-rata kalori/protein dari hari yang ada catatannya, n hari terakhir (termasuk hari ini). */
export async function recentDays(n: number, today: string): Promise<{ date: string; kcal: number; proteinG: number }[]> {
  const from = addDays(today, -(n - 1));
  const rows = must(
    await db().from("meals").select("meal_date,total_kcal,protein_g").eq("status", "tersimpan").gte("meal_date", from).lte("meal_date", today),
  ) as { meal_date: string; total_kcal: number; protein_g: number }[];
  const m = new Map<string, { kcal: number; proteinG: number }>();
  for (const r of rows) {
    const cur = m.get(r.meal_date) ?? { kcal: 0, proteinG: 0 };
    cur.kcal += Number(r.total_kcal);
    cur.proteinG += Number(r.protein_g);
    m.set(r.meal_date, cur);
  }
  return [...m.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([date, v]) => ({ date, kcal: Math.round(v.kcal), proteinG: Math.round(v.proteinG) }));
}

/** Ubah pengali porsi: total dan rentang dihitung ulang dari item. */
export async function setFactor(id: number, factor: number): Promise<Meal | null> {
  const meal = await getMeal(id);
  if (!meal) return null;
  const base = sumItems(
    meal.items.map((i) => ({ kcal: i.kcal, proteinG: i.proteinG, carbsG: i.carbsG, fatG: i.fatG })),
    factor,
  );
  // Rentang AI dihitung untuk porsi 1x, jadi skalakan dari nilai dasar
  const raw = must(await db().from("meals").select("ai_raw").eq("id", id).single()) as { ai_raw: { kcal_min?: number; kcal_max?: number } | null };
  const range = scaleRange(raw.ai_raw?.kcal_min ?? null, raw.ai_raw?.kcal_max ?? null, factor);

  must(
    await db()
      .from("meals")
      .update({
        portion_factor: factor,
        total_kcal: base.kcal,
        protein_g: base.proteinG,
        carbs_g: base.carbsG,
        fat_g: base.fatG,
        kcal_min: range.min,
        kcal_max: range.max,
      })
      .eq("id", id),
  );
  return getMeal(id);
}

export async function setStatus(id: number, status: "draft" | "tersimpan"): Promise<void> {
  must(await db().from("meals").update({ status }).eq("id", id));
}

export async function deleteMeal(id: number): Promise<void> {
  const meal = await getMeal(id);
  must(await db().from("meals").delete().eq("id", id));
  if (meal?.photoPath) await db().storage.from(BUCKET).remove([meal.photoPath]);
}

// ---------- Favorit ----------

export type Favorite = {
  id: number;
  name: string;
  portionDesc: string | null;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  useCount: number;
};

type FavRow = { id: number; name: string; portion_desc: string | null; kcal: number; protein_g: number; carbs_g: number; fat_g: number; use_count: number };

const toFav = (r: FavRow): Favorite => ({
  id: r.id,
  name: r.name,
  portionDesc: r.portion_desc,
  kcal: Number(r.kcal),
  proteinG: Number(r.protein_g),
  carbsG: Number(r.carbs_g),
  fatG: Number(r.fat_g),
  useCount: r.use_count,
});

export async function listFavorites(): Promise<Favorite[]> {
  const rows = must(
    await db()
      .from("favorite_foods")
      .select("id,name,portion_desc,kcal,protein_g,carbs_g,fat_g,use_count")
      .order("use_count", { ascending: false })
      .order("created_at", { ascending: false }),
  ) as FavRow[];
  return rows.map(toFav);
}

/** Simpan makan sebagai favorit dengan nilai yang sudah dikoreksi (termasuk pengali porsi). */
export async function addFavoriteFromMeal(mealId: number): Promise<Favorite | null> {
  const meal = await getMeal(mealId);
  if (!meal) return null;
  const name = (meal.description ?? meal.items.map((i) => i.name).join(", ")).slice(0, 80) || "Makanan favorit";
  const row = must(
    await db()
      .from("favorite_foods")
      .upsert(
        {
          name,
          portion_desc: meal.factor === 1 ? null : `porsi ${meal.factor}x`,
          kcal: meal.kcal,
          protein_g: meal.proteinG,
          carbs_g: meal.carbsG,
          fat_g: meal.fatG,
        },
        { onConflict: "name" },
      )
      .select("id,name,portion_desc,kcal,protein_g,carbs_g,fat_g,use_count")
      .single(),
  ) as FavRow;
  return toFav(row);
}

export async function deleteFavorite(id: number): Promise<void> {
  must(await db().from("favorite_foods").delete().eq("id", id));
}

/** Satu ketukan: catat favorit sebagai makan yang langsung tersimpan. */
export async function logFavorite(favId: number, date?: string): Promise<Meal | null> {
  const f = must(
    await db()
      .from("favorite_foods")
      .select("id,name,portion_desc,kcal,protein_g,carbs_g,fat_g,use_count")
      .eq("id", favId)
      .maybeSingle(),
  ) as FavRow | null;
  if (!f) return null;

  const row = must(
    await db()
      .from("meals")
      .insert({
        eaten_at: new Date().toISOString(),
        meal_date: date ?? todayWIB(),
        source: "favorit",
        description: f.name,
        total_kcal: f.kcal,
        protein_g: f.protein_g,
        carbs_g: f.carbs_g,
        fat_g: f.fat_g,
        confidence: "tinggi",
        status: "tersimpan",
        portion_factor: 1,
      })
      .select("id")
      .single(),
  ) as { id: number };

  must(
    await db()
      .from("meal_items")
      .insert({ meal_id: row.id, name: f.name, kcal: f.kcal, protein_g: f.protein_g, carbs_g: f.carbs_g, fat_g: f.fat_g }),
  );
  must(await db().from("favorite_foods").update({ use_count: f.use_count + 1 }).eq("id", favId));
  return getMeal(row.id);
}
