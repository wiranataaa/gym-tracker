// Uji kesimpulan AI dengan data tidur (tiruan, TIDAK ditulis ke database). Biaya ±beberapa sen (2 panggilan Sonnet).
// Jalankan: node --env-file=.env.local scripts/coba-tidur.ts

import { tulisKesimpulan } from "../lib/ai/summary.ts";
import { buildSummaryInput } from "../lib/workout/summaryData.ts";
import { listSessions } from "../lib/workout/history.ts";

const sesi = (await listSessions(10)).find((s) => s.status === "selesai" && s.totalSets > 0);
if (!sesi) {
  console.log("Belum ada sesi selesai buat dicoba.");
  process.exit(0);
}
const asli = await buildSummaryInput(sesi.id);
if (!asli) throw new Error("Data sesi nggak ketemu");

const varian = {
  "tidur kurang + cerita": {
    jam_tidur: "01:15",
    jam_bangun: "06:30",
    durasi_jam: 5.3,
    durasi_teks: "5 jam 15 menit",
    target_jam: 7,
    status: "kurang" as const,
    kualitas_1_sampai_5: 2,
    catatan_nata: "kebangun dua kali, susah tidur lagi",
    jam_bangun_ke_gym: 11.5,
    rata2_tidur_7_hari_jam: 6.2,
    malam_tercatat_7_hari: 4,
  },
  "tidur cukup": {
    jam_tidur: "22:45",
    jam_bangun: "06:00",
    durasi_jam: 7.3,
    durasi_teks: "7 jam 15 menit",
    target_jam: 7,
    status: "cukup" as const,
    kualitas_1_sampai_5: 4,
    catatan_nata: null,
    jam_bangun_ke_gym: 12,
    rata2_tidur_7_hari_jam: 7.1,
    malam_tercatat_7_hari: 6,
  },
  "tidur belum dicatat": null,
};

for (const [nama, tidur] of Object.entries(varian)) {
  const hasil = await tulisKesimpulan({ ...asli, tidur });
  console.log(`\n===== ${nama} (ditulis AI: ${hasil.pakaiAi ? "ya" : "TIDAK, cadangan"}) =====`);
  const bagian = hasil.text.split("\n\n");
  console.log(bagian.find((b) => b.startsWith("😴")) ?? "(bagian tidur nggak ada!)");
}
