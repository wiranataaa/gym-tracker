import { randomUUID } from "node:crypto";
import { listMeasurements } from "../body/db.ts";
import { BUCKET, signedPhotoUrls } from "../nutrition/db.ts";
import { db } from "../supabase.ts";
import { addDays } from "../time.ts";
import { type FotoBaris, type Sudut } from "./hitung.ts";

// Foto progres. File di bucket privat yang sama dengan foto makanan (folder "progres/").
// Pembacaan aman kalau tabelnya belum ada (SQL 010 belum dijalankan): hasilnya kosong, bukan error.

type Row = { id: number; photo_date: string; angle: Sudut; photo_path: string; weight_kg: number | null };
const COLS = "id,photo_date,angle,photo_path,weight_kg";

const toBaris = (r: Row): FotoBaris => ({ id: r.id, tanggal: r.photo_date, sudut: r.angle, path: r.photo_path, beratKg: r.weight_kg == null ? null : Number(r.weight_kg) });

export async function listFoto(): Promise<FotoBaris[]> {
  const { data, error } = await db().from("progress_photos").select(COLS).order("photo_date", { ascending: false }).limit(300);
  if (error || !data) return [];
  return (data as Row[]).map(toBaris);
}

export async function tanggalFotoTerakhir(): Promise<string | null> {
  const { data, error } = await db().from("progress_photos").select("photo_date").order("photo_date", { ascending: false }).limit(1).maybeSingle();
  if (error || !data) return null;
  return (data as { photo_date: string }).photo_date;
}

/** URL sementara (1 jam) untuk menampilkan foto dari bucket privat. */
export async function urlFoto(paths: string[]): Promise<Map<string, string>> {
  return signedPhotoUrls(paths);
}

/** Berat dari timbangan terakhir kalau umurnya <= 7 hari dari tanggal foto; selain itu null. */
async function beratTerdekat(tanggal: string): Promise<number | null> {
  try {
    const t = (await listMeasurements(1))[0];
    if (!t || t.date > tanggal || t.date < addDays(tanggal, -7)) return null;
    return t.weightKg;
  } catch {
    return null;
  }
}

/** Simpan foto untuk satu sudut di satu tanggal. Kalau sudah ada, fotonya diganti (file lama dihapus). */
export async function simpanFoto(args: { tanggal: string; sudut: Sudut; bytes: Uint8Array; contentType: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  const ext = args.contentType === "image/png" ? "png" : args.contentType === "image/webp" ? "webp" : "jpg";
  const path = `progres/${args.tanggal.slice(0, 4)}/${args.tanggal.slice(5, 7)}/${randomUUID()}.${ext}`;

  const lama = await db().from("progress_photos").select("photo_path").eq("photo_date", args.tanggal).eq("angle", args.sudut).maybeSingle();
  if (lama.error && /progress_photos/.test(lama.error.message) && /does not exist|schema cache/i.test(lama.error.message)) {
    return { ok: false, error: "Tabel foto progres belum dibuat. Jalankan file supabase/010_foto_progres.sql di Supabase dulu." };
  }

  const up = await db().storage.from(BUCKET).upload(path, args.bytes, { contentType: args.contentType, upsert: false });
  if (up.error) return { ok: false, error: "Upload foto gagal, coba lagi." };

  const { error } = await db()
    .from("progress_photos")
    .upsert({ photo_date: args.tanggal, angle: args.sudut, photo_path: path, weight_kg: await beratTerdekat(args.tanggal) }, { onConflict: "photo_date,angle" });
  if (error) {
    await db().storage.from(BUCKET).remove([path]);
    return { ok: false, error: "Gagal menyimpan foto, coba lagi." };
  }
  const lamaPath = (lama.data as { photo_path: string } | null)?.photo_path;
  if (lamaPath) await db().storage.from(BUCKET).remove([lamaPath]);
  return { ok: true };
}

export async function hapusFoto(id: number): Promise<void> {
  const { data } = await db().from("progress_photos").select("photo_path").eq("id", id).maybeSingle();
  await db().from("progress_photos").delete().eq("id", id);
  const path = (data as { photo_path: string } | null)?.photo_path;
  if (path) await db().storage.from(BUCKET).remove([path]);
}
