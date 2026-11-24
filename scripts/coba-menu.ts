// Uji BACA-SAJA terhadap data asli: cetak menu hari ini (dan menu tiap hari program) ke konsol.
// Tidak menulis ke database, tidak mengirim ke Telegram.
// Jalankan: node --env-file=.env.local scripts/coba-menu.ts

import { belumDiminum, listSuplemen } from "../lib/suplemen/db.ts";
import { todayWIB } from "../lib/time.ts";
import { loadProgram } from "../lib/workout/db.ts";
import { buildMenu, formatMenu, getSettings } from "../lib/workout/menu.ts";

const today = todayWIB();
const settings = await getSettings();

const menu = await buildMenu(today, "normal");
console.log(`=== Menu hari ini (${today}) — jenis: ${menu?.jenis} ===`);
console.log(menu ? formatMenu(menu, today, settings) : "(tidak ada menu)");

console.log("\n=== Mode singkat ===");
const singkat = await buildMenu(today, "singkat");
console.log(singkat?.items.map((p) => p.exercise.name).join(", "), "| kardio:", singkat?.kardio.menit, "menit");

console.log("\n=== Semua hari program (tanpa riwayat: target = pilih sendiri / bodyweight) ===");
const { days } = await loadProgram();
for (const d of days) {
  const m = await buildMenu(today, "normal", d.id);
  console.log(`\n[${d.kind}] ${d.name} — kardio ${m?.kardio.menit} menit${m?.recovery ? " (recovery)" : ""}`);
  console.log(m?.items.map((p) => `${p.exercise.name}${p.exercise.is_bodyweight ? " (bw)" : ""} ${p.sets}x${p.repMin}-${p.repMax}`).join("\n"));
}

console.log("\n=== Suplemen ===");
console.log((await listSuplemen(true)).map((s) => `${s.name} | ${s.doseDesc} | ${s.kcal} kcal | P ${s.proteinG} g | ingatkan: ${s.pengingat}`).join("\n"));
console.log("Belum diminum hari ini (pengingat):", (await belumDiminum(today)).map((s) => s.name).join(", ") || "-");
