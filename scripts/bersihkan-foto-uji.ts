// Hapus foto di bucket "meal-photos" yang nggak dipakai satu pun makanan (yatim).
// Jalankan: node --env-file=.env.local scripts/bersihkan-foto-uji.ts

import { db } from "../lib/supabase.ts";

const BUCKET = "meal-photos";

async function listAll(prefix = ""): Promise<string[]> {
  const { data, error } = await db().storage.from(BUCKET).list(prefix, { limit: 1000 });
  if (error) throw new Error(error.message);
  const out: string[] = [];
  for (const e of data ?? []) {
    const p = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.id === null) out.push(...(await listAll(p))); // folder
    else out.push(p);
  }
  return out;
}

const files = await listAll();
const { data: meals } = await db().from("meals").select("photo_path").not("photo_path", "is", null);
const dipakai = new Set((meals ?? []).map((m: { photo_path: string }) => m.photo_path));
const yatim = files.filter((f) => !dipakai.has(f));

if (yatim.length) await db().storage.from(BUCKET).remove(yatim);
console.log(`Foto di bucket: ${files.length}, dipakai: ${files.length - yatim.length}, dihapus (yatim): ${yatim.length}`);
