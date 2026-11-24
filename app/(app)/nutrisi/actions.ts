"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth.ts";
import { PORTION_FACTORS } from "@/lib/nutrition/calc.ts";
import { batalSuplemen, catatSuplemen, getSuplemen, hitungHariIni, ubahSuplemen } from "@/lib/suplemen/db.ts";
import { todayWIB } from "@/lib/time.ts";
import {
  addFavoriteFromMeal,
  deleteFavorite,
  deleteMeal,
  logFavorite,
  setFactor,
  setStatus,
} from "@/lib/nutrition/db.ts";

type Result = { ok: true } | { ok: false; error: string };

const refresh = () => revalidatePath("/nutrisi");
const validId = (n: number) => Number.isInteger(n) && n > 0;

export async function simpanMakan(id: number): Promise<Result> {
  await requireOwner();
  if (!validId(id)) return { ok: false, error: "Data nggak valid" };
  await setStatus(id, "tersimpan");
  refresh();
  return { ok: true };
}

export async function ubahPorsi(id: number, factor: number): Promise<Result> {
  await requireOwner();
  if (!validId(id) || !(PORTION_FACTORS as readonly number[]).includes(factor)) return { ok: false, error: "Porsi nggak valid" };
  await setFactor(id, factor);
  refresh();
  return { ok: true };
}

export async function hapusMakan(id: number): Promise<Result> {
  await requireOwner();
  if (!validId(id)) return { ok: false, error: "Data nggak valid" };
  await deleteMeal(id);
  refresh();
  return { ok: true };
}

export async function jadikanFavorit(id: number): Promise<Result> {
  await requireOwner();
  if (!validId(id)) return { ok: false, error: "Data nggak valid" };
  const fav = await addFavoriteFromMeal(id);
  if (!fav) return { ok: false, error: "Makanan nggak ketemu" };
  refresh();
  return { ok: true };
}

export async function pakaiFavorit(favId: number): Promise<Result> {
  await requireOwner();
  if (!validId(favId)) return { ok: false, error: "Data nggak valid" };
  const meal = await logFavorite(favId);
  if (!meal) return { ok: false, error: "Favorit nggak ketemu" };
  refresh();
  return { ok: true };
}

// ---------- Suplemen ----------

export async function catatSuplemenApp(id: number): Promise<Result> {
  await requireOwner();
  if (!validId(id)) return { ok: false, error: "Data nggak valid" };
  const sup = await getSuplemen(id);
  if (!sup) return { ok: false, error: "Suplemen nggak ketemu" };
  const makro = sup.kcal > 0 || sup.proteinG > 0;
  if (!makro && ((await hitungHariIni(todayWIB())).get(id) ?? 0) > 0) return { ok: false, error: "Udah tercatat hari ini" };
  await catatSuplemen(id, todayWIB());
  refresh();
  return { ok: true };
}

export async function batalSuplemenApp(id: number): Promise<Result> {
  await requireOwner();
  if (!validId(id)) return { ok: false, error: "Data nggak valid" };
  const ok = await batalSuplemen(id, todayWIB());
  refresh();
  return ok ? { ok: true } : { ok: false, error: "Belum ada catatan hari ini" };
}

export async function ubahSuplemenApp(
  id: number,
  patch: { doseDesc: string; kcal: number; proteinG: number; carbsG: number; fatG: number; pengingat: boolean },
): Promise<Result> {
  await requireOwner();
  if (!validId(id)) return { ok: false, error: "Data nggak valid" };
  const { doseDesc, kcal, proteinG, carbsG, fatG, pengingat } = patch;
  const dalam = (n: number, max: number) => Number.isFinite(n) && n >= 0 && n <= max;
  if (!doseDesc.trim() || doseDesc.length > 60) return { ok: false, error: "Takaran 1-60 karakter" };
  if (!dalam(kcal, 1500) || !dalam(proteinG, 200) || !dalam(carbsG, 300) || !dalam(fatG, 150)) return { ok: false, error: "Angka gizinya nggak masuk akal" };
  await ubahSuplemen(id, {
    dose_desc: doseDesc.trim(),
    kcal: Math.round(kcal * 10) / 10,
    protein_g: Math.round(proteinG * 10) / 10,
    carbs_g: Math.round(carbsG * 10) / 10,
    fat_g: Math.round(fatG * 10) / 10,
    pengingat: !!pengingat,
  });
  refresh();
  return { ok: true };
}

export async function hapusFavorit(favId: number): Promise<Result> {
  await requireOwner();
  if (!validId(favId)) return { ok: false, error: "Data nggak valid" };
  await deleteFavorite(favId);
  refresh();
  return { ok: true };
}
