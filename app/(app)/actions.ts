"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { buatKesimpulanSesi } from "@/lib/ai/summary.ts";
import { requireOwner, supabaseAuth } from "@/lib/auth.ts";
import { sahWaktuGym } from "@/lib/program/waktu.ts";
import { hapusTidur, simpanTidur } from "@/lib/tidur/db.ts";
import { todayWIB } from "@/lib/time.ts";
import {
  closeStaleSessions,
  deleteSet,
  finishSession,
  getOpenSession,
  getTodayPlan,
  loadProgram,
  logSets,
  saveCardio,
  savePlan,
  setSkipped,
  startSession,
} from "@/lib/workout/db.ts";
import { ambilCalon, batalkanGanti, lakukanGanti, type Calon } from "@/lib/workout/ganti.ts";
import { buildMenu } from "@/lib/workout/menu.ts";

// Setiap aksi WAJIB cek login dulu: Server Action bisa dipanggil langsung lewat POST.

type Result = { ok: true } | { ok: false; error: string };

function refresh() {
  revalidatePath("/");
}

/**
 * Catat tidur dari app: tanggal dan jam tidur serta bangun diisi sendiri. `asal` = tanggal bangun
 * catatan yang lagi diubah; kalau tanggal bangunnya dipindah, catatan lama dihapus.
 */
export async function simpanTidurApp(input: {
  tanggalTidur: string;
  jamTidur: string;
  tanggalBangun: string;
  jamBangun: string;
  kualitas: number | null;
  catatan: string;
  asal: string | null;
}): Promise<Result> {
  await requireOwner();
  const tanggalBangun = String(input.tanggalBangun ?? "");
  const r = await simpanTidur({
    tanggalTidur: String(input.tanggalTidur ?? ""),
    tanggalBangun,
    jamTidur: String(input.jamTidur ?? ""),
    jamBangun: String(input.jamBangun ?? ""),
    kualitas: input.kualitas == null ? null : Number(input.kualitas),
    catatan: String(input.catatan ?? "").slice(0, 300),
  });
  if (!r.ok) return { ok: false, error: r.error };
  if (input.asal && input.asal !== tanggalBangun && /^\d{4}-\d{2}-\d{2}$/.test(input.asal)) await hapusTidur(input.asal);
  refresh();
  return { ok: true };
}

export async function hapusTidurApp(tanggalBangun: string): Promise<Result> {
  await requireOwner();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggalBangun)) return { ok: false, error: "Tanggal nggak valid" };
  await hapusTidur(tanggalBangun);
  refresh();
  return { ok: true };
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

/** Rencana jam gym hari ini (pagi / malam); null = kosongkan. */
export async function pilihWaktuGym(waktu: "pagi" | "malam" | null): Promise<Result> {
  await requireOwner();
  if (waktu !== null && !sahWaktuGym(waktu)) return { ok: false, error: "Pilihan nggak valid" };
  await savePlan(todayWIB(), { plan: waktu ? { waktu_gym: waktu } : [] });
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

/** Ganti menu hari ini (utama A/B/C atau bonus D/E/F). Nggak bisa kalau sesi sudah jalan. */
export async function pilihMenuHariIni(dayId: number): Promise<Result> {
  await requireOwner();
  if (!Number.isInteger(dayId) || dayId <= 0) return { ok: false, error: "Menu nggak valid" };
  const today = todayWIB();
  if (await getOpenSession(today)) return { ok: false, error: "Sesi udah jalan, menu nggak bisa diganti" };
  const { days } = await loadProgram();
  if (!days.some((d) => d.id === dayId)) return { ok: false, error: "Menu nggak ketemu" };
  await savePlan(today, { program_day_id: dayId, status: "disarankan" });
  refresh();
  return { ok: true };
}

/** Lewati sisa set satu gerakan di sesi yang berjalan (atau batalkan). */
export async function lewatiGerakan(exerciseId: number, lewati: boolean): Promise<Result> {
  await requireOwner();
  if (!Number.isInteger(exerciseId) || exerciseId <= 0) return { ok: false, error: "Gerakan nggak valid" };
  const open = await getOpenSession(todayWIB());
  if (!open) return { ok: false, error: "Nggak ada sesi yang jalan" };
  const r = await setSkipped(open.id, exerciseId, !!lewati);
  if (r.ok) refresh();
  return r;
}

/** Pilihan pengganti untuk satu gerakan (alat penuh). */
export async function calonGantiApp(exerciseId: number): Promise<{ ok: true; calon: Calon[] } | { ok: false; error: string }> {
  await requireOwner();
  if (!Number.isInteger(exerciseId) || exerciseId <= 0) return { ok: false, error: "Gerakan nggak valid" };
  return ambilCalon(todayWIB(), exerciseId);
}

export async function gantiGerakanApp(dariId: number, keId: number): Promise<Result> {
  await requireOwner();
  if (![dariId, keId].every((n) => Number.isInteger(n) && n > 0)) return { ok: false, error: "Gerakan nggak valid" };
  const r = await lakukanGanti(todayWIB(), dariId, keId);
  if (!r.ok) return r;
  refresh();
  return { ok: true };
}

export async function batalGantiApp(keId: number): Promise<Result> {
  await requireOwner();
  if (!Number.isInteger(keId) || keId <= 0) return { ok: false, error: "Gerakan nggak valid" };
  const r = await batalkanGanti(todayWIB(), keId);
  if (r.ok) refresh();
  return r;
}

/** Catat menit kardio (jalan di treadmill) di sesi yang sedang berjalan. 0 = kosongkan. */
export async function simpanKardio(menit: number): Promise<Result> {
  await requireOwner();
  if (!Number.isInteger(menit) || menit < 0 || menit > 240) return { ok: false, error: "Menitnya nggak masuk akal" };
  const open = await getOpenSession(todayWIB());
  if (!open) return { ok: false, error: "Nggak ada sesi yang jalan" };
  await saveCardio(open.id, menit === 0 ? null : menit);
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

  // Kesimpulan AI ditulis di belakang layar; halaman menampilkannya begitu siap
  const sessionId = open.id;
  after(async () => {
    try {
      await buatKesimpulanSesi(sessionId);
    } catch (err) {
      console.error("Kesimpulan gagal:", err);
    }
  });

  refresh();
  return { ok: true };
}
