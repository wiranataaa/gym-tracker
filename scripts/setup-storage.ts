// Bikin bucket privat "meal-photos" di Supabase Storage buat foto makanan (sekali jalan, aman diulang).
// Jalankan: node --env-file=.env.local scripts/setup-storage.ts

import { db } from "../lib/supabase.ts";

const BUCKET = "meal-photos";

const { data: existing, error: listError } = await db().storage.listBuckets();
if (listError) throw new Error(`Gagal cek bucket: ${listError.message}`);

if (existing?.some((b) => b.name === BUCKET)) {
  console.log(`Bucket "${BUCKET}" sudah ada.`);
} else {
  const { error } = await db().storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: 8 * 1024 * 1024, // 8 MB per foto
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  });
  if (error) throw new Error(`Gagal bikin bucket: ${error.message}`);
  console.log(`Bucket "${BUCKET}" dibuat (privat, maks 8 MB, jpeg/png/webp).`);
}

const { data: after } = await db().storage.listBuckets();
const b = after?.find((x) => x.name === BUCKET);
console.log(`Cek: ada=${!!b}, publik=${b?.public}`);
