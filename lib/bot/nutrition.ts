import { estimateFromPhoto, estimateFromText, type EstimasiData, type EstimateResult, type ImageType } from "../ai/nutrition.ts";
import { labelPorsi, PENJELASAN_PORSI, persen, PORTION_FACTORS, sisa } from "../nutrition/calc.ts";
import {
  addFavoriteFromMeal,
  createDraft,
  dayTotals,
  deleteMeal,
  getMeal,
  listFavorites,
  logFavorite,
  removePhoto,
  setFactor,
  setStatus,
  uploadPhoto,
  type Meal,
} from "../nutrition/db.ts";
import type { Keyboard } from "../telegram.ts";
import { fmtInt, fmtKg, todayWIB } from "../time.ts";
import { getSettings } from "../workout/db.ts";
import type { Ctx } from "./handlers.ts";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // batas gambar Claude

const KONFIDENSI: Record<string, string> = { rendah: "rendah 🟠", sedang: "sedang 🟡", tinggi: "tinggi 🟢" };

async function progressLine(date: string): Promise<string> {
  const [t, s] = await Promise.all([dayTotals(date), getSettings()]);
  const kcalSisa = sisa(t.kcal, s.target_kcal);
  const protSisa = sisa(t.proteinG, s.target_protein_g);
  return [
    `📊 Hari ini: ${fmtInt(t.kcal)} / ${fmtInt(s.target_kcal)} kcal (${persen(t.kcal, s.target_kcal)}%)`,
    `Protein ${fmtKg(t.proteinG)} / ${s.target_protein_g} g (${persen(t.proteinG, s.target_protein_g)}%)`,
    kcalSisa > 0 || protSisa > 0 ? `Sisa: ${fmtInt(kcalSisa)} kcal · protein ${fmtKg(protSisa)} g` : "Target hari ini tercapai 🎉",
  ].join("\n");
}

function formatMeal(meal: Meal, progress?: string, pertanyaan?: string): string {
  const lines: string[] = [];
  lines.push(`🍽️ ${meal.description ?? "Makanan"}${meal.status === "draft" ? " (belum disimpan)" : " ✅"}`);
  for (const i of meal.items) {
    const gram = i.portionG ? ` ±${fmtInt(i.portionG * meal.factor)} g` : "";
    lines.push(`• ${i.name}${gram} — ${fmtInt(i.kcal * meal.factor)} kcal · P ${fmtKg(i.proteinG * meal.factor)} g`);
  }
  lines.push("");
  const range = meal.kcalMin != null && meal.kcalMax != null ? ` (kisaran ${fmtInt(meal.kcalMin)}–${fmtInt(meal.kcalMax)})` : "";
  lines.push(`Total: ${fmtInt(meal.kcal)} kcal${range}`);
  lines.push(`Protein ${fmtKg(meal.proteinG)} g · Karbo ${fmtKg(meal.carbsG)} g · Lemak ${fmtKg(meal.fatG)} g`);
  lines.push(`Porsi dipakai: ${labelPorsi(meal.factor)}${meal.confidence ? ` · keyakinan ${KONFIDENSI[meal.confidence]}` : ""}`);
  if (pertanyaan) lines.push(`❓ ${pertanyaan}`);
  if (meal.source !== "favorit") lines.push("ℹ️ Estimasi AI bisa meleset ±20–30%. Yang penting konsisten.");
  if (progress) {
    lines.push("");
    lines.push(progress);
  }
  lines.push("", `👇 ${PENJELASAN_PORSI}`);
  return lines.join("\n");
}

function mealKeyboard(meal: Meal): Keyboard {
  const porsi = PORTION_FACTORS.map((f) => ({
    text: `${meal.factor === f ? "• " : ""}${labelPorsi(f)}`,
    data: `mk:p:${meal.id}:${f}`,
  }));
  const rows: Keyboard = [];
  if (meal.status === "draft") rows.push([{ text: "✅ Simpan", data: `mk:s:${meal.id}` }]);
  rows.push(porsi);
  rows.push([
    ...(meal.source !== "favorit" ? [{ text: "⭐ Favorit", data: `mk:f:${meal.id}` }] : []),
    { text: meal.status === "draft" ? "🗑️ Buang" : "🗑️ Hapus", data: `mk:d:${meal.id}` },
  ]);
  return rows;
}

/** Edit pesan yang diklik kalau bisa, kalau nggak kirim pesan baru. */
async function show(ctx: Ctx, text: string, keyboard?: Keyboard): Promise<void> {
  if (ctx.edit) await ctx.edit(text, keyboard);
  else await ctx.send(text, keyboard);
}

async function kirimHasil(ctx: Ctx, result: EstimateResult, source: "foto" | "teks", photoPath: string | null): Promise<void> {
  if (!result.ok) {
    await removePhoto(photoPath); // jangan tinggalkan foto yatim di Storage
    await ctx.send(`😅 ${result.reason}`);
    return;
  }
  const data: EstimasiData = result.data;
  if (!data.ada_makanan || data.item.length === 0) {
    await removePhoto(photoPath);
    await ctx.send("Itu kayaknya bukan makanan 🤔 Coba kirim foto atau deskripsi makanan yang lebih jelas.");
    return;
  }
  const meal = await createDraft({ source, data, photoPath, aiModel: result.model, date: ctx.today });
  await ctx.send(formatMeal(meal, undefined, data.pertanyaan || undefined), mealKeyboard(meal));
}

export async function handlePhoto(ctx: Ctx, fileId: string, caption?: string): Promise<void> {
  await ctx.send("📸 Lagi gua hitung…");
  const file = ctx.downloadPhoto ? await ctx.downloadPhoto(fileId) : null;
  if (!file) {
    await ctx.send("Fotonya nggak bisa diunduh 😅 Coba kirim ulang.");
    return;
  }
  if (file.bytes.byteLength > MAX_IMAGE_BYTES) {
    await ctx.send("Fotonya kebesaran (maks 5 MB). Coba kirim ulang sebagai foto biasa, bukan file.");
    return;
  }
  const mime = file.mime as ImageType;
  const base64 = Buffer.from(file.bytes).toString("base64");

  const [photoPath, result] = await Promise.all([
    uploadPhoto(file.bytes, mime).catch((e) => {
      console.error("Upload foto gagal:", String(e));
      return null;
    }),
    estimateFromPhoto(base64, mime, caption),
  ]);
  await kirimHasil(ctx, result, "foto", photoPath);
}

export async function handleMakanText(ctx: Ctx, text: string): Promise<void> {
  if (!text.trim()) {
    await ctx.send("Contoh: /makan nasi putih 1 piring + ayam bakar paha + tempe 2");
    return;
  }
  await ctx.send("🧮 Lagi gua hitung…");
  await kirimHasil(ctx, await estimateFromText(text), "teks", null);
}

export async function showFavorites(ctx: Ctx): Promise<void> {
  const favs = await listFavorites();
  if (favs.length === 0) {
    await ctx.send("Belum ada favorit. Habis kirim foto makanan, klik ⭐ Favorit buat nyimpen (nilainya yang udah lo koreksi).");
    return;
  }
  const rows: Keyboard = favs.slice(0, 12).map((f) => [{ text: `⭐ ${f.name.slice(0, 40)} · ${fmtInt(f.kcal)} kcal`, data: `mk:u:${f.id}` }]);
  await ctx.send("Pilih favorit buat dicatat sekali tap:", rows);
}

export async function showProgress(ctx: Ctx): Promise<void> {
  await ctx.send(await progressLine(ctx.today ?? todayWIB()));
}

/** Tangani tombol "mk:..." . Mengembalikan true kalau datanya milik fitur ini. */
export async function handleNutriCallback(ctx: Ctx, data: string): Promise<boolean> {
  if (!data.startsWith("mk:")) return false;
  const today = ctx.today ?? todayWIB();
  const parts = data.split(":");
  const action = parts[1];
  const id = Number(parts[2]);
  if (!Number.isInteger(id) || id <= 0) return true;

  if (action === "u") {
    const meal = await logFavorite(id, ctx.today);
    if (!meal) {
      await ctx.send("Favoritnya nggak ketemu.");
      return true;
    }
    await ctx.send(formatMeal(meal, await progressLine(meal.date)), mealKeyboard(meal));
    return true;
  }

  const meal = await getMeal(id);
  if (!meal) {
    await show(ctx, "Makanan itu udah nggak ada (mungkin udah dibuang).");
    return true;
  }

  if (action === "s") {
    await setStatus(id, "tersimpan");
    const saved = (await getMeal(id))!;
    await show(ctx, formatMeal(saved, await progressLine(saved.date)), mealKeyboard(saved));
  } else if (action === "p") {
    const f = Number(parts[3]);
    if (!(PORTION_FACTORS as readonly number[]).includes(f)) return true;
    const updated = (await setFactor(id, f))!;
    await show(ctx, formatMeal(updated, updated.status === "tersimpan" ? await progressLine(updated.date) : undefined), mealKeyboard(updated));
  } else if (action === "f") {
    const fav = await addFavoriteFromMeal(id);
    await ctx.send(fav ? `⭐ Disimpan jadi favorit: ${fav.name} (${fmtInt(fav.kcal)} kcal · P ${fmtKg(fav.proteinG)} g). Pakai lewat /fav.` : "Gagal nyimpen favorit.");
  } else if (action === "d") {
    await deleteMeal(id);
    await show(ctx, `🗑️ Dihapus.\n\n${await progressLine(today)}`);
  }
  return true;
}
