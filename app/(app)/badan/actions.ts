"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth.ts";
import { insertMeasurement, removeMeasurement } from "@/lib/body/db.ts";

type Result = { ok: true } | { ok: false; error: string };

export async function simpanTimbangan(input: { weightKg: number; standar: boolean }): Promise<Result> {
  await requireOwner();
  const { weightKg, standar } = input;
  if (!(weightKg >= 30 && weightKg <= 250)) return { ok: false, error: "Beratnya kayaknya nggak masuk akal" };
  await insertMeasurement(Math.round(weightKg * 100) / 100, !!standar);
  revalidatePath("/badan");
  return { ok: true };
}

export async function hapusTimbangan(id: number): Promise<Result> {
  await requireOwner();
  if (!Number.isInteger(id) || id <= 0) return { ok: false, error: "Data nggak valid" };
  await removeMeasurement(id);
  revalidatePath("/badan");
  return { ok: true };
}
