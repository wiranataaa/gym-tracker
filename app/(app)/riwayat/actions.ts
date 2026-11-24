"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth.ts";
import { deleteSet } from "@/lib/workout/db.ts";
import { deleteSession, updateSet } from "@/lib/workout/history.ts";

type Result = { ok: true } | { ok: false; error: string };

function refresh() {
  revalidatePath("/riwayat");
  revalidatePath("/progres");
  revalidatePath("/");
}

export async function ubahSet(input: { setId: number; weightKg: number; reps: number; rpe: number | null }): Promise<Result> {
  await requireOwner();
  const { setId, weightKg, reps, rpe } = input;
  if (!Number.isInteger(setId) || setId <= 0) return { ok: false, error: "Set nggak valid" };
  if (!(weightKg >= 0 && weightKg <= 500)) return { ok: false, error: "Beban nggak masuk akal" };
  if (!Number.isInteger(reps) || reps < 1 || reps > 100) return { ok: false, error: "Reps nggak masuk akal" };
  if (rpe != null && !(rpe >= 1 && rpe <= 10)) return { ok: false, error: "RPE harus 1-10" };
  await updateSet(setId, weightKg, reps, rpe);
  refresh();
  return { ok: true };
}

export async function hapusSetRiwayat(setId: number): Promise<Result> {
  await requireOwner();
  if (!Number.isInteger(setId) || setId <= 0) return { ok: false, error: "Set nggak valid" };
  await deleteSet(setId);
  refresh();
  return { ok: true };
}

export async function hapusSesi(sessionId: number): Promise<Result> {
  await requireOwner();
  if (!Number.isInteger(sessionId) || sessionId <= 0) return { ok: false, error: "Sesi nggak valid" };
  await deleteSession(sessionId);
  refresh();
  return { ok: true };
}
