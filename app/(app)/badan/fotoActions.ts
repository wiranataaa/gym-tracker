"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth.ts";
import { hapusFoto, simpanFoto } from "@/lib/foto/db.ts";
import { sudutValid } from "@/lib/foto/hitung.ts";
import { todayWIB } from "@/lib/time.ts";

const MAKS_BYTE = 4 * 1024 * 1024;
const TIPE = ["image/jpeg", "image/png", "image/webp"];

type Hasil = { ok: true } | { ok: false; error: string };

/** Simpan foto progres hari ini untuk satu sudut (foto sudah diperkecil di browser). */
export async function unggahFotoProgres(formData: FormData): Promise<Hasil> {
  await requireOwner();
  const file = formData.get("foto");
  const sudut = formData.get("sudut");
  if (!(file instanceof File)) return { ok: false, error: "Pilih fotonya dulu." };
  if (!sudutValid(sudut)) return { ok: false, error: "Sudut foto nggak valid." };
  if (!TIPE.includes(file.type)) return { ok: false, error: "Format harus JPG, PNG, atau WebP." };
  if (file.size > MAKS_BYTE) return { ok: false, error: "Fotonya kebesaran (maks 4 MB)." };

  const r = await simpanFoto({ tanggal: todayWIB(), sudut, bytes: new Uint8Array(await file.arrayBuffer()), contentType: file.type });
  if (r.ok) revalidatePath("/badan");
  return r;
}

export async function hapusFotoProgres(id: number): Promise<Hasil> {
  await requireOwner();
  if (!Number.isInteger(id) || id <= 0) return { ok: false, error: "Foto nggak valid." };
  await hapusFoto(id);
  revalidatePath("/badan");
  return { ok: true };
}
