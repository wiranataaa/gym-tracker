// Uji pembaca layar Tanita pada SATU gambar (memanggil Claude, biayanya sekitar 1 sen). Tidak menyimpan apa pun.
// Jalankan: node --env-file=.env.local scripts/coba-tanita.ts <path-gambar>

import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { bacaTanita } from "../lib/ai/tanita.ts";
import { validasiKomposisi } from "../lib/body/tanitaValid.ts";

const path = process.argv[2];
if (!path) throw new Error("Kasih path gambar: node --env-file=.env.local scripts/coba-tanita.ts <gambar>");
const ext = extname(path).toLowerCase();
const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";

const hasil = await bacaTanita(readFileSync(path).toString("base64"), mime);
if (!hasil.ok) {
  console.log("GAGAL:", hasil.reason);
  process.exit(1);
}
console.log("Hasil baca:", hasil.data);
console.log("Catatan AI:", hasil.catatan || "-");
console.log("Validasi:", validasiKomposisi(hasil.data, 178));

// Jawaban benar dari data awal Nata (30 Okt 2026), sudah dikoreksi dari pergeseran baris
const benar: Record<string, number> = {
  beratKg: 71.1,
  bodyFatPct: 19.5,
  muscleMassKg: 54.25,
  muscleScore: 0,
  bmi: 22.4,
  muscleQuality: 68,
  visceralFat: 7.5,
  boneMassKg: 3.0,
  bodyWaterPct: 53.7,
  bmrKcal: 1625,
  metabolicAge: 24,
};
let salah = 0;
for (const [k, v] of Object.entries(benar)) {
  const dibaca = (hasil.data as Record<string, unknown>)[k];
  const cocok = typeof dibaca === "number" && Math.abs(dibaca - v) < 0.011;
  if (!cocok) salah++;
  console.log(`${cocok ? "✔" : "✘"} ${k}: dibaca ${dibaca}, seharusnya ${v}`);
}
console.log(salah === 0 ? "\n✅ SEMUA 11 ANGKA BENAR" : `\n❌ ${salah} angka salah`);
