import { batalGanti, calonPengganti, tambahGanti } from "../program/ganti.ts";
import { hitungSet } from "../program/lewati.ts";
import { getHistory, getOpenSession, getSessionSets, getSwaps, loadExercises, saveSwaps, setSkipped, type SessionRow } from "./db.ts";
import { buildMenu, targetGerakan, targetLine, type PlannedExercise } from "./menu.ts";

// Ganti gerakan di sesi yang sedang berjalan. Dipakai bersama oleh app dan bot.

export type Calon = { id: number; name: string; alat: string; target: string };

type Konteks = { sesi: SessionRow; item: PlannedExercise; sudah: number; items: PlannedExercise[] };

async function konteks(today: string, dariId: number): Promise<{ ok: true; k: Konteks } | { ok: false; error: string }> {
  const sesi = await getOpenSession(today);
  if (!sesi) return { ok: false, error: "Mulai sesi latihan dulu, baru bisa ganti gerakan." };
  const menu = await buildMenu(today, sesi.mode, sesi.program_day_id);
  const item = menu?.items.find((p) => p.exercise.id === dariId);
  if (!menu || !item) return { ok: false, error: "Gerakan itu nggak ada di menu sesi ini." };
  const sets = await getSessionSets(sesi.id);
  const sudah = hitungSet(sets.filter((s) => !s.is_warmup).map((s) => s.exercise_id)).get(dariId) ?? 0;
  if (sudah >= item.sets) return { ok: false, error: "Set gerakan itu udah lengkap, nggak perlu diganti." };
  return { ok: true, k: { sesi, item, sudah, items: menu.items } };
}

async function daftarCalon(today: string, k: Konteks): Promise<Calon[]> {
  const pilihan = calonPengganti(
    k.item.exercise,
    await loadExercises(),
    k.items.map((p) => p.exercise.id),
  );
  if (pilihan.length === 0) return [];
  const riwayat = await getHistory(
    pilihan.map((e) => e.id),
    today,
  );
  const skema = { sets: k.item.sets - k.sudah, repMin: k.item.repMin, repMax: k.item.repMax };
  return pilihan.map((e) => ({
    id: e.id,
    name: e.name,
    alat: e.equipment,
    target: targetLine({ ...k.item, ...skema, exercise: e, target: targetGerakan(riwayat.get(e.id) ?? [], skema, e, today) }),
  }));
}

/** Pilihan pengganti untuk satu gerakan, lengkap dengan target beban dari riwayat gerakan pengganti. */
export async function ambilCalon(today: string, dariId: number): Promise<{ ok: true; nama: string; calon: Calon[] } | { ok: false; error: string }> {
  const r = await konteks(today, dariId);
  if (!r.ok) return r;
  return { ok: true, nama: r.k.item.exercise.name, calon: await daftarCalon(today, r.k) };
}

export async function lakukanGanti(
  today: string,
  dariId: number,
  keId: number,
): Promise<{ ok: true; dari: string; ke: Calon } | { ok: false; error: string }> {
  const r = await konteks(today, dariId);
  if (!r.ok) return r;
  const ke = (await daftarCalon(today, r.k)).find((c) => c.id === keId);
  if (!ke) return { ok: false, error: "Pengganti itu nggak tersedia untuk gerakan ini." };
  const daftar = tambahGanti(await getSwaps(r.k.sesi.id), dariId, keId, r.k.sudah);
  const simpan = await saveSwaps(r.k.sesi.id, daftar);
  if (!simpan.ok) return simpan;
  // Status "dilewati" lama nggak berlaku lagi untuk gerakan yang diganti atau penggantinya
  await setSkipped(r.k.sesi.id, dariId, false);
  await setSkipped(r.k.sesi.id, keId, false);
  return { ok: true, dari: r.k.item.exercise.name, ke };
}

/** Balikin ke gerakan asal. Hanya kalau penggantinya belum ada set. */
export async function batalkanGanti(today: string, keId: number): Promise<{ ok: true } | { ok: false; error: string }> {
  const sesi = await getOpenSession(today);
  if (!sesi) return { ok: false, error: "Sesinya udah ditutup." };
  const daftar = await getSwaps(sesi.id);
  if (!daftar.some((g) => g.ke === keId)) return { ok: false, error: "Gerakan itu bukan pengganti." };
  const sets = await getSessionSets(sesi.id);
  if (sets.some((s) => s.exercise_id === keId && !s.is_warmup)) {
    return { ok: false, error: "Penggantinya udah ada set tercatat. Kalau salah catat, hapus setnya dulu." };
  }
  return saveSwaps(sesi.id, batalGanti(daftar, keId));
}
