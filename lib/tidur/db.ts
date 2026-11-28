import { db } from "../supabase.ts";
import { addDays, namaHari, tglSingkat, todayWIB } from "../time.ts";
import { cariBentrok, jamWIB, MAKS_DURASI_MENIT, susunMulaiTidur, susunWaktuTidurTanggal, tebakTanggalTidur } from "./hitung.ts";

// Catatan tidur: satu baris per tidur (boleh lebih dari sekali sehari). Baris tanpa jam bangun = masih tidur.
// Semua pembacaan aman kalau tabelnya belum ada: hasilnya kosong, bukan error, supaya halaman lain tetap jalan.

export type Tidur = {
  id: number;
  tanggalBangun: string;
  tanggalTidur: string; // tanggal WIB mulai tidur
  jamTidur: string; // "HH:MM" WIB
  jamBangun: string;
  sleptAt: string;
  wokeAt: string;
  durasiMenit: number;
  kualitas: number | null;
  catatan: string | null;
};

export type TidurAktif = {
  id: number;
  tanggalTidur: string;
  jamTidur: string;
  sleptAt: string;
  /** sudah lebih dari batas durasi: kemungkinan lupa tap "udah bangun" */
  kelamaan: boolean;
};

type Row = { id: number; wake_date: string; slept_at: string; woke_at: string; duration_min: number; quality: number | null; note: string | null };

const COLS = "id,wake_date,slept_at,woke_at,duration_min,quality,note";

const toTidur = (r: Row): Tidur => ({
  id: r.id,
  tanggalBangun: r.wake_date,
  tanggalTidur: todayWIB(new Date(r.slept_at)),
  jamTidur: jamWIB(r.slept_at),
  jamBangun: jamWIB(r.woke_at),
  sleptAt: r.slept_at,
  wokeAt: r.woke_at,
  durasiMenit: r.duration_min,
  kualitas: r.quality,
  catatan: r.note,
});

/** Tidur yang sudah ditutup, bangunnya dalam `hari` terakhir sampai tanggal `sampai`; terbaru dulu. */
export async function listTidur(sampai: string, hari = 7): Promise<Tidur[]> {
  const { data, error } = await db()
    .from("sleep_logs")
    .select(COLS)
    .not("woke_at", "is", null)
    .gte("wake_date", addDays(sampai, -(hari - 1)))
    .lte("wake_date", sampai)
    .order("woke_at", { ascending: false });
  if (error || !data) return [];
  return (data as Row[]).map(toTidur);
}

/** Semua tidur yang bangunnya di tanggal itu, urut dari yang paling awal. */
export async function tidurHari(tanggalBangun: string): Promise<Tidur[]> {
  return (await listTidur(tanggalBangun, 1)).reverse();
}

/** Tidur yang belum ditutup (sudah "mau tidur", belum "udah bangun"). */
export async function tidurAktif(): Promise<TidurAktif | null> {
  const { data, error } = await db().from("sleep_logs").select("id,slept_at").is("woke_at", null).order("slept_at", { ascending: false }).limit(1).maybeSingle();
  if (error || !data) return null;
  const r = data as { id: number; slept_at: string };
  return {
    id: r.id,
    sleptAt: r.slept_at,
    tanggalTidur: todayWIB(new Date(r.slept_at)),
    jamTidur: jamWIB(r.slept_at),
    kelamaan: Date.now() - Date.parse(r.slept_at) > MAKS_DURASI_MENIT * 60_000,
  };
}

/** Jam tidur & bangun dari catatan terbaru (buat isi awal formulir). */
export async function tidurTerakhir(): Promise<Tidur | null> {
  const { data, error } = await db().from("sleep_logs").select(COLS).not("woke_at", "is", null).order("woke_at", { ascending: false }).limit(1).maybeSingle();
  if (error || !data) return null;
  return toTidur(data as Row);
}

export type HasilSimpanTidur = { ok: true; tidur: Tidur } | { ok: false; error: string };
type Gagal = { ok: false; error: string };

const label = (t: { tanggalTidur: string; jamTidur: string }) => `${namaHari(t.tanggalTidur)}, ${tglSingkat(t.tanggalTidur)} ${t.jamTidur}`;

function pesanGagal(error: { message: string } | null): string {
  const m = error?.message ?? "";
  if (/sleep_logs/.test(m) && /does not exist|schema cache/i.test(m)) return "Tabel tidur belum dibuat. Jalankan file supabase/009_tidur.sql di Supabase dulu.";
  if (/null value in column|sleep_logs_wake_date_key/.test(m)) return "Fitur tidur baru belum aktif. Jalankan file supabase/013_tidur_fleksibel.sql di Supabase dulu.";
  return "Gagal menyimpan tidur, coba lagi.";
}

const kualitasSah = (k: number | null | undefined) => k == null || (Number.isInteger(k) && k >= 1 && k <= 5);
const rapikan = (c: string | null | undefined) => (c?.trim() ? c.trim().slice(0, 300) : null);

/** Catatan tertutup di sekitar rentang waktu ini (buat cek bentrok). */
async function sekitar(sleptAt: string, wokeAt: string): Promise<Tidur[]> {
  const { data, error } = await db().from("sleep_logs").select(COLS).not("woke_at", "is", null).lt("slept_at", wokeAt).gt("woke_at", sleptAt);
  if (error || !data) return [];
  return (data as Row[]).map(toTidur);
}

/** "Mau tidur": buat catatan baru yang jam bangunnya menyusul. */
export async function mulaiTidur(tanggal: string, jam: string): Promise<{ ok: true; aktif: TidurAktif } | Gagal> {
  const w = susunMulaiTidur(tanggal, jam);
  if (!w.ok) return w;
  const sudah = await tidurAktif();
  if (sudah) return { ok: false, error: `Masih ada tidur yang belum ditutup (${label(sudah)}). Tap "udah bangun" atau batalin dulu.` };
  const semenit = new Date(Date.parse(w.sleptAt) + 60_000).toISOString();
  const bentrok = cariBentrok(await sekitar(w.sleptAt, semenit), w.sleptAt, semenit);
  if (bentrok) return { ok: false, error: `Jam segitu lo tercatat masih tidur (${label(bentrok)} → ${bentrok.jamBangun}).` };
  const { error } = await db().from("sleep_logs").insert({ slept_at: w.sleptAt, woke_at: null, wake_date: null, duration_min: null });
  if (error) return { ok: false, error: pesanGagal(error) };
  const aktif = await tidurAktif();
  return aktif ? { ok: true, aktif } : { ok: false, error: pesanGagal(null) };
}

/** Koreksi jam mulai tidur yang belum ditutup. */
export async function ubahMulaiTidur(id: number, tanggal: string, jam: string): Promise<{ ok: true } | Gagal> {
  const w = susunMulaiTidur(tanggal, jam);
  if (!w.ok) return w;
  const { error } = await db().from("sleep_logs").update({ slept_at: w.sleptAt, updated_at: new Date().toISOString() }).eq("id", id).is("woke_at", null);
  return error ? { ok: false, error: pesanGagal(error) } : { ok: true };
}

/**
 * Simpan satu tidur lengkap. `id` diisi = ubah baris itu (termasuk menutup tidur yang masih aktif);
 * tanpa id = catatan baru. Catatan lain nggak pernah ditimpa: kalau jamnya tumpang tindih, ditolak.
 * Kualitas dan catatan yang nggak diisi (undefined) tetap pakai nilai lama.
 */
export async function simpanTidur(args: {
  id?: number | null;
  tanggalBangun: string;
  jamTidur: string;
  jamBangun: string;
  /** diisi dari formulir app; kalau kosong (bot) tanggal tidurnya ditebak dari jam */
  tanggalTidur?: string;
  kualitas?: number | null;
  catatan?: string | null;
}): Promise<HasilSimpanTidur> {
  const tanggalTidur = args.tanggalTidur ?? tebakTanggalTidur(args.tanggalBangun, args.jamTidur, args.jamBangun);
  const w = susunWaktuTidurTanggal({ tanggalTidur, jamTidur: args.jamTidur, tanggalBangun: args.tanggalBangun, jamBangun: args.jamBangun });
  if (!w.ok) return w;
  if (!kualitasSah(args.kualitas)) return { ok: false, error: "Kualitas tidur harus 1-5" };
  const { sleptAt, wokeAt, durasiMenit } = w.waktu;

  const tetangga = await sekitar(sleptAt, wokeAt);
  // Jam yang persis sama dikirim ulang (mis. nambah cerita lewat bot) = ubah catatan itu
  const kembar = args.id ? null : tetangga.find((t) => Date.parse(t.sleptAt) === Date.parse(sleptAt) && Date.parse(t.wokeAt) === Date.parse(wokeAt));
  const id = args.id ?? kembar?.id ?? null;

  const bentrok = cariBentrok(tetangga, sleptAt, wokeAt, id);
  if (bentrok) return { ok: false, error: `Jamnya tumpang tindih sama catatan lain: ${label(bentrok)} → ${bentrok.jamBangun}. Ubah catatan itu dari tabel kalau memang salah.` };
  const aktif = await tidurAktif();
  if (aktif && aktif.id !== id && Date.parse(aktif.sleptAt) < Date.parse(wokeAt)) {
    return { ok: false, error: `Masih ada tidur yang belum ditutup (${label(aktif)}). Tap "udah bangun" atau batalin dulu.` };
  }

  const isi: Record<string, unknown> = { wake_date: args.tanggalBangun, slept_at: sleptAt, woke_at: wokeAt, duration_min: durasiMenit, updated_at: new Date().toISOString() };
  if (args.kualitas !== undefined) isi.quality = args.kualitas;
  if (args.catatan !== undefined) isi.note = rapikan(args.catatan);

  const q = id ? db().from("sleep_logs").update(isi).eq("id", id) : db().from("sleep_logs").insert(isi);
  const { data, error } = await q.select(COLS).maybeSingle();
  if (error) return { ok: false, error: pesanGagal(error) };
  if (!data) return { ok: false, error: "Catatan tidurnya nggak ketemu." };
  return { ok: true, tidur: toTidur(data as Row) };
}

/** "Udah bangun": tutup tidur yang aktif. */
export async function selesaiTidur(args: { tanggalBangun: string; jamBangun: string; kualitas?: number | null; catatan?: string | null }): Promise<HasilSimpanTidur> {
  const aktif = await tidurAktif();
  if (!aktif) return { ok: false, error: "Nggak ada catatan tidur yang lagi jalan." };
  return simpanTidur({ ...args, id: aktif.id, tanggalTidur: aktif.tanggalTidur, jamTidur: aktif.jamTidur });
}

export async function setKualitasTidur(id: number, kualitas: number): Promise<Tidur | null> {
  if (!kualitasSah(kualitas)) return null;
  const { data, error } = await db().from("sleep_logs").update({ quality: kualitas, updated_at: new Date().toISOString() }).eq("id", id).select(COLS).maybeSingle();
  if (error || !data) return null;
  return toTidur(data as Row);
}

export async function hapusTidur(id: number): Promise<void> {
  await db().from("sleep_logs").delete().eq("id", id);
}
