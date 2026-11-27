import { db } from "../supabase.ts";
import { addDays, todayWIB } from "../time.ts";
import { jamWIB, susunWaktuTidur, susunWaktuTidurTanggal } from "./hitung.ts";

// Catatan tidur per malam, dikunci tanggal BANGUN (WIB). Semua pembacaan aman kalau tabelnya
// belum ada (SQL 009 belum dijalankan): hasilnya kosong, bukan error, supaya halaman lain tetap jalan.

export type Tidur = {
  id: number;
  tanggalBangun: string;
  tanggalTidur: string; // tanggal WIB mulai tidur
  jamTidur: string; // "HH:MM" WIB
  jamBangun: string;
  durasiMenit: number;
  kualitas: number | null;
  catatan: string | null;
};

type Row = { id: number; wake_date: string; slept_at: string; woke_at: string; duration_min: number; quality: number | null; note: string | null };

const COLS = "id,wake_date,slept_at,woke_at,duration_min,quality,note";

const toTidur = (r: Row): Tidur => ({
  id: r.id,
  tanggalBangun: r.wake_date,
  tanggalTidur: todayWIB(new Date(r.slept_at)),
  jamTidur: jamWIB(r.slept_at),
  jamBangun: jamWIB(r.woke_at),
  durasiMenit: r.duration_min,
  kualitas: r.quality,
  catatan: r.note,
});

export async function getTidur(tanggalBangun: string): Promise<Tidur | null> {
  const { data, error } = await db().from("sleep_logs").select(COLS).eq("wake_date", tanggalBangun).maybeSingle();
  if (error || !data) return null;
  return toTidur(data as Row);
}

/** Catatan tidur `hari` terakhir sampai tanggal `sampai` (termasuk), terbaru dulu. */
export async function listTidur(sampai: string, hari = 7): Promise<Tidur[]> {
  const { data, error } = await db()
    .from("sleep_logs")
    .select(COLS)
    .gte("wake_date", addDays(sampai, -(hari - 1)))
    .lte("wake_date", sampai)
    .order("wake_date", { ascending: false });
  if (error || !data) return [];
  return (data as Row[]).map(toTidur);
}

/** Jam tidur/bangun dari catatan terbaru (buat isi awal formulir). */
export async function tidurTerakhir(): Promise<Tidur | null> {
  const { data, error } = await db().from("sleep_logs").select(COLS).order("wake_date", { ascending: false }).limit(1).maybeSingle();
  if (error || !data) return null;
  return toTidur(data as Row);
}

export type HasilSimpanTidur = { ok: true; tidur: Tidur } | { ok: false; error: string };

/**
 * Simpan (atau timpa) tidur untuk satu tanggal bangun. Kualitas dan catatan yang nggak diisi
 * (undefined) tetap pakai nilai lama kalau tanggal itu sudah ada catatannya.
 */
export async function simpanTidur(args: {
  tanggalBangun: string;
  jamTidur: string;
  jamBangun: string;
  /** diisi dari formulir app; kalau kosong (bot) tanggal tidurnya ditebak dari jam */
  tanggalTidur?: string;
  kualitas?: number | null;
  catatan?: string | null;
}): Promise<HasilSimpanTidur> {
  const w =
    args.tanggalTidur != null
      ? susunWaktuTidurTanggal({ tanggalTidur: args.tanggalTidur, jamTidur: args.jamTidur, tanggalBangun: args.tanggalBangun, jamBangun: args.jamBangun })
      : susunWaktuTidur(args.tanggalBangun, args.jamTidur, args.jamBangun);
  if (!w.ok) return w;
  if (args.kualitas != null && !(Number.isInteger(args.kualitas) && args.kualitas >= 1 && args.kualitas <= 5)) return { ok: false, error: "Kualitas tidur harus 1-5" };

  const lama = await getTidur(args.tanggalBangun);
  const row = {
    wake_date: args.tanggalBangun,
    slept_at: w.waktu.sleptAt,
    woke_at: w.waktu.wokeAt,
    duration_min: w.waktu.durasiMenit,
    quality: args.kualitas === undefined ? (lama?.kualitas ?? null) : args.kualitas,
    note: args.catatan === undefined ? (lama?.catatan ?? null) : args.catatan?.trim() ? args.catatan.trim().slice(0, 300) : null,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await db().from("sleep_logs").upsert(row, { onConflict: "wake_date" }).select(COLS).single();
  if (error || !data) {
    const belumAda = error?.message?.includes("sleep_logs") && /does not exist|schema cache/i.test(error.message);
    return { ok: false, error: belumAda ? "Tabel tidur belum dibuat. Jalankan file supabase/009_tidur.sql di Supabase dulu." : "Gagal menyimpan tidur, coba lagi." };
  }
  return { ok: true, tidur: toTidur(data as Row) };
}

export async function setKualitasTidur(tanggalBangun: string, kualitas: number): Promise<Tidur | null> {
  if (!(Number.isInteger(kualitas) && kualitas >= 1 && kualitas <= 5)) return null;
  const { data, error } = await db()
    .from("sleep_logs")
    .update({ quality: kualitas, updated_at: new Date().toISOString() })
    .eq("wake_date", tanggalBangun)
    .select(COLS)
    .maybeSingle();
  if (error || !data) return null;
  return toTidur(data as Row);
}

export async function hapusTidur(tanggalBangun: string): Promise<void> {
  await db().from("sleep_logs").delete().eq("wake_date", tanggalBangun);
}
