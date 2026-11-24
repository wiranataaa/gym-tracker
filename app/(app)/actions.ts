"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOwner, supabaseAuth } from "@/lib/auth.ts";
import { todayWIB } from "@/lib/time.ts";
import {
  closeStaleSessions,
  deleteSet,
  finishSession,
  getOpenSession,
  getTodayPlan,
  logSets,
  savePlan,
  startSession,
} from "@/lib/workout/db.ts";
import { buildMenu } from "@/lib/workout/menu.ts";

// Setiap aksi WAJIB cek login dulu: Server Action bisa dipanggil langsung lewat POST.

type Result = { ok: true } | { ok: false; error: string };

function refresh() {
  revalidatePath("/");
}

export async function keluar() {
  await supabaseAuth().then((s) => s.auth.signOut());
  redirect("/login");
}

async function mulaiSesi(today: string) {
  await closeStaleSessions(today);
  const open = await getOpenSession(today);
  if (open) return open;

  const plan = await getTodayPlan(today);
  const mode = plan?.mode ?? "normal";
  const menu = await buildMenu(today, mode);
  if (!menu) throw new Error("Program belum ada");
  const session = await startSession(today, menu.day.id, mode);
  await savePlan(today, { program_day_id: menu.day.id, mode, status: "dikerjakan" });
  return session;
}

export async function mulaiLatihan(): Promise<Result> {
  await requireOwner();
  await mulaiSesi(todayWIB());
  refresh();
  return { ok: true };
}

export async function ubahMode(mode: "normal" | "singkat"): Promise<Result> {
  await requireOwner();
  if (mode !== "normal" && mode !== "singkat") return { ok: false, error: "Mode nggak valid" };
  const today = todayWIB();
  if (await getOpenSession(today)) return { ok: false, error: "Sesi udah jalan, mode nggak bisa diganti" };
  await savePlan(today, { mode, status: "disarankan" });
  refresh();
  return { ok: true };
}

export async function skipHariIni(): Promise<Result> {
  await requireOwner();
  const today = todayWIB();
  if (await getOpenSession(today)) return { ok: false, error: "Sesi udah jalan" };
  await savePlan(today, { status: "dilewati" });
  refresh();
  return { ok: true };
}

export async function batalSkip(): Promise<Result> {
  await requireOwner();
  await savePlan(todayWIB(), { status: "disarankan" });
  refresh();
  return { ok: true };
}

export async function simpanSet(input: {
  exerciseId: number;
  weightKg: number;
  reps: number;
  rpe: number | null;
  isWarmup: boolean;
}): Promise<Result> {
  await requireOwner();
  const { exerciseId, weightKg, reps, rpe, isWarmup } = input;
  if (!Number.isInteger(exerciseId) || exerciseId <= 0) return { ok: false, error: "Gerakan nggak valid" };
  if (!(weightKg >= 0 && weightKg <= 500)) return { ok: false, error: "Beban nggak masuk akal" };
  if (!Number.isInteger(reps) || reps < 1 || reps > 100) return { ok: false, error: "Reps nggak masuk akal" };
  if (rpe != null && !(rpe >= 1 && rpe <= 10)) return { ok: false, error: "RPE harus 1-10" };

  const session = await mulaiSesi(todayWIB());
  await logSets({ sessionId: session.id, exerciseId, weightKg, reps: [reps], rpe, isWarmup });
  refresh();
  return { ok: true };
}

export async function hapusSet(setId: number): Promise<Result> {
  await requireOwner();
  if (!Number.isInteger(setId) || setId <= 0) return { ok: false, error: "Set nggak valid" };
  await deleteSet(setId);
  refresh();
  return { ok: true };
}

export async function selesaiLatihan(energy: number): Promise<Result> {
  await requireOwner();
  if (!Number.isInteger(energy) || energy < 1 || energy > 5) return { ok: false, error: "Energi harus 1-5" };
  const open = await getOpenSession(todayWIB());
  if (!open) return { ok: false, error: "Nggak ada sesi yang jalan" };
  await finishSession(open.id, energy);
  refresh();
  return { ok: true };
}
