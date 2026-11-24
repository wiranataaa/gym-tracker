"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth.ts";
import { bacaTanita } from "@/lib/ai/tanita.ts";
import { simpanKomposisi, tinggiCm, type Kondisi } from "@/lib/body/db.ts";
import { validasiKomposisi, type HasilValidasi, type KomposisiBaca } from "@/lib/body/tanitaValid.ts";

const MAKS_BYTE = 4 * 1024 * 1024;
const TIPE = ["image/jpeg", "image/png", "image/webp"] as const;
const KONDISI_VALID: Kondisi[] = ["sebelum_latihan", "pagi_puasa", "setelah_olahraga", "setelah_makan", "lainnya"];

export type HasilBacaApp = ({ ok: true; data: KomposisiBaca; catatan: string } & HasilValidasi) | { ok: false; error: string };

/** Baca foto layar Tanita yang diunggah dari app. Belum menyimpan apa pun. */
export async function bacaTanitaApp(formData: FormData): Promise<HasilBacaApp> {
  await requireOwner();
  const file = formData.get("foto");
  if (!(file instanceof File)) return { ok: false, error: "Pilih fotonya dulu." };
  if (!(TIPE as readonly string[]).includes(file.type)) return { ok: false, error: "Format harus JPG, PNG, atau WebP." };
  if (file.size > MAKS_BYTE) return { ok: false, error: "Fotonya kebesaran (maks 4 MB)." };

  const bytes = Buffer.from(await file.arrayBuffer());
  const hasil = await bacaTanita(bytes.toString("base64"), file.type as (typeof TIPE)[number]);
  if (!hasil.ok) return { ok: false, error: hasil.reason };

  const v = validasiKomposisi(hasil.data, await tinggiCm());
  return { ok: true, data: hasil.data, catatan: hasil.catatan, ...v };
}

/** Simpan hasil yang sudah dicek (dan mungkin dikoreksi) di app. Masalah serius menahan penyimpanan. */
export async function simpanTanitaApp(input: { data: KomposisiBaca; kondisi: Kondisi }): Promise<{ ok: true; duplikat: boolean } | { ok: false; error: string }> {
  await requireOwner();
  if (!KONDISI_VALID.includes(input.kondisi)) return { ok: false, error: "Kondisi timbang nggak valid" };
  const v = validasiKomposisi(input.data, await tinggiCm());
  if (v.masalah.length > 0) return { ok: false, error: v.masalah.join(" ") };

  const r = await simpanKomposisi(input.data, input.kondisi, "foto_tanita");
  for (const p of ["/badan", "/"]) revalidatePath(p);
  return { ok: true, duplikat: r.duplikat };
}
