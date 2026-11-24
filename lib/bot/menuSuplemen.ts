import { dayTotals } from "../nutrition/db.ts";
import { batalSuplemen, catatSuplemen, getSuplemen, hitungHariIni, listSuplemen } from "../suplemen/db.ts";
import type { Keyboard } from "../telegram.ts";
import { fmtInt, fmtKg } from "../time.ts";
import { getOpenSession, getSettings, loadProgram, savePlan, saveCardio } from "../workout/db.ts";
import type { Ctx } from "./handlers.ts";

// ---------- Ganti menu (variasi kalau latihan tiap hari) ----------

export async function showGantiMenu(ctx: Ctx, today: string): Promise<void> {
  const open = await getOpenSession(today);
  if (open) {
    await ctx.send("Sesi hari ini udah jalan, menunya nggak bisa diganti lagi. /selesai dulu kalau mau.");
    return;
  }
  const { days } = await loadProgram();
  const urut = [...days].sort((a, b) => (a.kind === b.kind ? a.position - b.position : a.kind === "utama" ? -1 : 1));
  const rows: Keyboard = urut.map((d) => [{ text: `${d.kind === "bonus" ? "✨" : "🏋️"} ${d.name}`, data: `pm:${d.id}` }]);
  await ctx.send(
    "Pilih menu buat hari ini.\n🏋️ = Full Body utama (A/B/C)\n✨ = bonus buat variasi kalau latihan lebih dari 3x seminggu (D/E/F)\n\nAntrean A→B→C nggak berubah kalau lo pilih bonus.",
    rows,
  );
}

export async function pilihMenu(ctx: Ctx, today: string, dayId: number, tampilkan: () => Promise<void>): Promise<void> {
  if (await getOpenSession(today)) {
    await ctx.send("Sesi hari ini udah jalan, menunya nggak bisa diganti lagi.");
    return;
  }
  const { days } = await loadProgram();
  if (!days.some((d) => d.id === dayId)) {
    await ctx.send("Menu itu nggak ketemu.");
    return;
  }
  await savePlan(today, { program_day_id: dayId, status: "disarankan" });
  await tampilkan();
}

// ---------- Kardio ----------

export async function catatKardio(ctx: Ctx, today: string, menit: number): Promise<void> {
  if (!Number.isInteger(menit) || menit < 0 || menit > 240) {
    await ctx.send("Menitnya kayaknya nggak masuk akal. Contoh: kardio 20");
    return;
  }
  const open = await getOpenSession(today);
  if (!open) {
    await ctx.send("Belum ada sesi yang jalan hari ini. Mulai dulu dengan /mulai atau catat setmu, baru catat kardionya.");
    return;
  }
  await saveCardio(open.id, menit);
  await ctx.send(menit === 0 ? "Kardio hari ini dikosongin." : `🚶 Kardio ${menit} menit tercatat. Mantap!`);
}

// ---------- Suplemen ----------

const adaMakro = (s: { kcal: number; proteinG: number }) => s.kcal > 0 || s.proteinG > 0;

export async function tampilSuplemen(ctx: Ctx, today: string): Promise<void> {
  const [list, hitung] = await Promise.all([listSuplemen(true), hitungHariIni(today)]);
  if (list.length === 0) {
    await ctx.send("Belum ada suplemen. (Tabel suplemen belum siap atau kosong.)");
    return;
  }
  const lines = ["💊 Suplemen hari ini", ""];
  const rows: Keyboard = [];
  for (const s of list) {
    const n = hitung.get(s.id) ?? 0;
    if (adaMakro(s)) {
      lines.push(`${n > 0 ? "✅" : "⬜"} ${s.name} — ${s.doseDesc}: ${n}x (${fmtInt(s.kcal)} kcal · P ${fmtKg(s.proteinG)} g per dosis, ikut kehitung di nutrisi)`);
      rows.push([
        { text: `➕ ${s.name.split(" ")[0]} +1`, data: `sp:${s.id}` },
        ...(n > 0 ? [{ text: "↩️ Batal", data: `spx:${s.id}` }] : []),
      ]);
    } else {
      lines.push(`${n > 0 ? "✅" : "⬜"} ${s.name} — ${s.doseDesc}${n > 0 ? " (udah)" : ""}`);
      rows.push([{ text: n > 0 ? `↩️ Batal ${s.name.split(" ")[0]}` : `✅ ${s.name.split(" ")[0]} udah`, data: n > 0 ? `spx:${s.id}` : `sp:${s.id}` }]);
    }
  }
  lines.push("", "Nilai kalori/protein whey bisa diatur di app (tab Nutrisi → Suplemen) sesuai label produk lo.");
  await ctx.send(lines.join("\n"), rows);
}

/** Tangani tombol "sp:{id}" (catat) dan "spx:{id}" (batal). true kalau memang milik fitur ini. */
export async function callbackSuplemen(ctx: Ctx, today: string, data: string): Promise<boolean> {
  const m = data.match(/^(sp|spx):(\d+)$/);
  if (!m) return false;
  const id = Number(m[2]);
  const sup = await getSuplemen(id);
  if (!sup) {
    await ctx.send("Suplemennya nggak ketemu.");
    return true;
  }

  if (m[1] === "spx") {
    const ok = await batalSuplemen(id, today);
    await ctx.send(ok ? `↩️ ${sup.name} dibatalkan.` : `Belum ada catatan ${sup.name} hari ini.`);
    return true;
  }

  // Yang tanpa kalori (creatine) cukup sekali sehari; ketukan kedua nggak menggandakan
  const sudah = (await hitungHariIni(today)).get(id) ?? 0;
  if (!adaMakro(sup) && sudah > 0) {
    await ctx.send(`✅ ${sup.name} udah tercatat hari ini.`);
    return true;
  }

  await catatSuplemen(id, today);
  if (adaMakro(sup)) {
    const [t, s] = await Promise.all([dayTotals(today), getSettings()]);
    await ctx.send(
      `🥤 ${sup.name} +1 (${fmtInt(sup.kcal)} kcal · P ${fmtKg(sup.proteinG)} g).\n📊 Hari ini: ${fmtInt(t.kcal)} / ${fmtInt(s.target_kcal)} kcal · protein ${fmtKg(t.proteinG)} / ${s.target_protein_g} g`,
    );
  } else {
    await ctx.send(`✅ ${sup.name} tercatat. Konsistensi tiap hari yang penting.`);
  }
  return true;
}
