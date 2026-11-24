"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth.ts";
import { insertMeasurement, removeMeasurement, type Kondisi } from "@/lib/body/db.ts";

type Result = { ok: true } | { ok: false; error: string };

const KONDISI_VALID: Kondisi[] = ["sebelum_latihan", "pagi_puasa", "setelah_olahraga", "setelah_makan", "lainnya"];

export async function simpanTimbangan(input: { weightKg: number; kondisi: Kondisi }): Promise<Result> {
  await requireOwner();
  const { weightKg, kondisi } = input;
  if (!(weightKg >= 30 && weightKg <= 250)) return { ok: false, error: "Beratnya kayaknya nggak masuk akal" };
  if (!KONDISI_VALID.includes(kondisi)) return { ok: false, error: "Kondisi timbang nggak valid" };
  await insertMeasurement(Math.round(weightKg * 100) / 100, kondisi);
  revalidatePath("/badan");
  revalidatePath("/");
  return { ok: true };
}

export async function hapusTimbangan(id: number): Promise<Result> {
  await requireOwner();
  if (!Number.isInteger(id) || id <= 0) return { ok: false, error: "Data nggak valid" };
  await removeMeasurement(id);
  revalidatePath("/badan");
  revalidatePath("/");
  return { ok: true };
}
