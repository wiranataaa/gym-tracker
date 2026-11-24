// Uji BACA-SAJA terhadap data asli: bangun tiap CSV export dan tampilkan beberapa baris pertama,
// plus ringkasan mode Ramadan dan biaya AI bulan ini. Tidak menulis apa pun.
// Jalankan: node --env-file=.env.local scripts/coba-export.ts

import { buatExport, JENIS_VALID } from "../lib/export/data.ts";
import { biayaBulanIni } from "../lib/pengaturan/db.ts";
import { bagiRamadan } from "../lib/ramadan/ramadan.ts";
import { todayWIB } from "../lib/time.ts";
import { getSettings } from "../lib/workout/db.ts";

for (const jenis of JENIS_VALID) {
  const csv = await buatExport(jenis);
  const baris = csv.replace(/^﻿/, "").trim().split(/\r\n/);
  console.log(`\n=== ${jenis}: ${baris.length - 1} baris data ===`);
  console.log(baris.slice(0, 3).join("\n"));
}

const s = await getSettings();
console.log("\n=== Pengaturan efektif ===");
console.log({ target_kcal: s.target_kcal, normal: s.target_kcal_normal, maintenance: s.kcal_maintenance, ramadan_aktif: s.ramadan_aktif, override: s.ramadan_override, mulai: s.ramadan_start, lebaran: s.lebaran_date });

const uji = await getSettings("2027-02-20");
console.log("\n=== Simulasi tanggal 2027-02-20 (di dalam Ramadan, override auto) ===");
console.log({ ramadan_aktif: uji.ramadan_aktif, target_kcal: uji.target_kcal });
console.log(bagiRamadan(uji.target_kcal, uji.target_protein_g).map((p) => `${p.nama}: ${p.kcal} kcal, ${p.proteinG} g protein`).join("\n"));

const b = await biayaBulanIni(todayWIB());
console.log("\n=== Biaya AI bulan ini ===");
console.log(`${b.bulan}: $${b.total.toFixed(4)}, ${b.fitur.length} fitur`);
