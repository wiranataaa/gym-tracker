// Uji pembaca kalimat bebas (model Haiku, biaya ±sepersepuluh sen per kalimat). Tidak mencatat set apa pun.
// Jalankan: node --env-file=.env.local scripts/coba-set-bebas.ts

import { tebakSetBebas } from "../lib/ai/setBebas.ts";
import { loadExercises } from "../lib/workout/db.ts";

const nama = (await loadExercises()).map((e) => ({ nama: e.name, bodyweight: e.is_bodyweight }));

const kasus: { teks: string; harapan: "set" | "bukan_set" | "makanan" | "tidak_jelas"; cek?: (s: { gerakan: string; bebanKg: number; reps: number[] }) => boolean }[] = [
  { teks: "tadi bench 60 kilo 10 kali 3 set", harapan: "set", cek: (s) => s.gerakan === "Bench Press" && s.bebanKg === 60 && s.reps.join() === "10,10,10" },
  { teks: "habis itu row 40 kg 10 reps 3x", harapan: "set", cek: (s) => s.gerakan === "Barbell Row" && s.bebanKg === 40 && s.reps.join() === "10,10,10" },
  { teks: "lat pulldown 46 kilo dapet 12, 12, 10", harapan: "set", cek: (s) => s.gerakan === "Lat Pulldown" && s.bebanKg === 46 && s.reps.join() === "12,12,10" },
  { teks: "squat pemanasan 40 kilo 8 kali", harapan: "set", cek: (s) => s.gerakan === "Barbell Back Squat" && s.bebanKg === 40 && s.reps.join() === "8" },
  { teks: "hanging leg raise 3 set 12 kali", harapan: "set", cek: (s) => s.gerakan === "Hanging Leg Raise" && s.reps.join() === "12,12,12" },
  { teks: "udah makan siang nasi padang 2 piring", harapan: "makanan" },
  { teks: "tadi di kantor gua makan pizza 2 potong lupa difoto", harapan: "makanan" },
  { teks: "sarapan nasi uduk sama telur dadar", harapan: "makanan" },
  { teks: "minum es kopi susu 1 gelas", harapan: "makanan" },
  { teks: "makan 2 telur rebus", harapan: "makanan" },
  { teks: "besok latihan jam 6 pagi ya", harapan: "bukan_set" },
  { teks: "deadlift 100 kilo 5 kali", harapan: "tidak_jelas" },
];

let salah = 0;
for (const k of kasus) {
  const h = await tebakSetBebas(k.teks, nama);
  const hasil = h.ok ? "set" : h.alasan;
  const benar = hasil === k.harapan && (!h.ok || !k.cek || k.cek(h.set));
  if (!benar) salah++;
  console.log(`${benar ? "✔" : "✘"} "${k.teks}" -> ${h.ok ? JSON.stringify(h.set) : h.alasan} (harapan: ${k.harapan})`);
}
console.log(salah === 0 ? "\n✅ SEMUA KASUS BENAR" : `\n❌ ${salah} kasus salah`);
