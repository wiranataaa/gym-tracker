import { test } from "node:test";
import assert from "node:assert/strict";
import { formatLaporan, type Laporan } from "./mingguan.ts";

const dasar: Laporan = {
  mingguMulai: "2026-11-30",
  mingguSelesai: "2026-12-06",
  sesi: { selesai: 3, target: 3, skor: 100, streak: 4, singkat: 1 },
  berat: {
    rataSekarang: 71.6,
    rataMingguLalu: 71.3,
    laju: 0.3,
    lajuLalu: 0.1,
    targetKg: 75,
    targetTanggal: "2027-03-10",
    hariLagi: 94,
    butuhPerMinggu: 0.25,
    proyeksiKg: 75.2,
  },
  pr: [{ nama: "Bench Press", e1rm: 82.3, kg: 65, reps: 8 }],
  stagnan: ["Barbell Row"],
  nutrisi: { hariTercatat: 5, rataKcal: 2540, rataProtein: 128, hariProteinTercapai: 2, targetKcal: 2700, targetProtein: 135 },
  kalori: { sebelum: 2700, kcalBaru: 2850, berubah: true, alasan: "Berat naik di bawah 0,2 kg/minggu selama 2 minggu berturut-turut. Target naik 150 kcal." },
  deload: { perlu: true, alasan: ["Udah ±8 minggu latihan (20 sesi) sejak deload terakhir / mulai."], aktif: false, sampai: null },
};

test("laporan lengkap memuat semua bagian dengan angka dari data", () => {
  const t = formatLaporan(dasar);
  for (const s of [
    "Laporan mingguan (30 Nov – 6 Des)",
    "3 dari 3 sesi → konsistensi 100% 🔥",
    "Streak: 4 minggu",
    "1 sesi pakai versi singkat",
    "Rata-rata 7 hari: 71,6 kg (minggu lalu 71,3 → +0,3 kg)",
    "Target 75 kg sebelum 10 Mar 2027: 94 hari lagi, butuh ±0,25 kg/minggu",
    "perkiraan 75,2 kg",
    "Bench Press: estimasi 1RM 82,3 kg (65 × 8)",
    "Barbell Row",
    "5 hari tercatat · rata-rata 2.540 kcal",
    "protein tercapai 2 dari 5 hari",
    "2.700 → 2.850 kcal",
    "Saran deload (minggu ringan)",
    "Udah ±8 minggu latihan",
    "/deload mulai",
  ]) {
    assert.ok(t.includes(s), `tidak ditemukan: ${s}\n\n${t}`);
  }
});

test("laporan minggu kosong tetap ramah dan nggak error", () => {
  const kosong: Laporan = {
    ...dasar,
    sesi: { selesai: 0, target: 3, skor: 0, streak: 0, singkat: 0 },
    berat: { ...dasar.berat, rataSekarang: null, rataMingguLalu: null, laju: null, lajuLalu: null, hariLagi: null, butuhPerMinggu: null, proyeksiKg: null },
    pr: [],
    stagnan: [],
    nutrisi: { hariTercatat: 0, rataKcal: null, rataProtein: null, hariProteinTercapai: 0, targetKcal: 2700, targetProtein: 135 },
    kalori: { sebelum: 2700, kcalBaru: 2700, berubah: false, alasan: "Data timbangan belum cukup." },
    deload: { perlu: false, alasan: [], aktif: false, sampai: null },
  };
  const t = formatLaporan(kosong);
  assert.ok(t.includes("0 dari 3 sesi → konsistensi 0%"));
  assert.ok(t.includes("Belum ada PR"));
  assert.ok(t.includes("Tetap 2.700 kcal"));
  assert.ok(!t.includes("NaN") && !t.includes("undefined"));
});
