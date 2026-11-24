"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth.ts";
import { PORTION_FACTORS } from "@/lib/nutrition/calc.ts";
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

export async function hapusFavorit(favId: number): Promise<Result> {
  await requireOwner();
  if (!validId(favId)) return { ok: false, error: "Data nggak valid" };
  await deleteFavorite(favId);
  refresh();
  return { ok: true };
}
