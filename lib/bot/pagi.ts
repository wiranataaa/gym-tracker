import { listMeasurements } from "../body/db.ts";
import { daysBetween } from "../body/trend.ts";
import { addDays, fmtInt, fmtKg, isoWeekday, namaHari, tglLengkap, todayWIB } from "../time.ts";
import { dayTotals } from "../nutrition/db.ts";
import { getSettings } from "../workout/db.ts";
import { listSessions } from "../workout/history.ts";
import { handleBotInput, type Ctx } from "./handlers.ts";
import { pengingatTimbang } from "./pengingat.ts";

export const APP_URL = process.env.APP_URL ?? "https://gym-tracker-nu-two-90.vercel.app";

/**
 * Pesan pagi, dikirim tiap hari (hari latihan atau bukan, pagi atau malam latihannya):
 * rekap singkat kemarin (latihan + kalori/protein), lalu menu hari ini dengan target beban.
 * Semua angka dari kode, tanpa AI.
 */
export async function pesanPagi(ctx: Ctx): Promise<void> {
  const today = ctx.today ?? todayWIB();
  const kemarin = addDays(today, -1);

  const [sesi, nut, settings, ukur] = await Promise.all([listSessions(40), dayTotals(kemarin), getSettings(), listMeasurements(1)]);
  const sKemarin = sesi.filter((s) => s.date === kemarin && s.status === "selesai" && s.totalSets > 0);

  const lines: string[] = [`☀️ Selamat pagi, Nata! ${namaHari(today)}, ${tglLengkap(today)}`, ""];

  if (sKemarin.length > 0) {
    const sets = sKemarin.reduce((a, s) => a + s.totalSets, 0);
    const vol = sKemarin.reduce((a, s) => a + s.volumeKg, 0);
    const energi = sKemarin.find((s) => s.energy)?.energy;
    lines.push(`🏋️ Kemarin: ${sKemarin.map((s) => s.dayName).join(" + ")} — ${sets} set · ${fmtInt(vol)} kg${energi ? ` · energi ${energi}/5` : ""}`);
  } else if (settings.workout_days.includes(isoWeekday(kemarin))) {
    lines.push("🏋️ Kemarin nggak latihan. Nggak apa-apa, hari ini mulai lagi dari menu yang sama.");
  } else {
    lines.push("🏋️ Kemarin hari istirahat.");
  }

  if (nut.count > 0) {
    lines.push(`🍽️ Kemarin: ${fmtInt(nut.kcal)} / ${fmtInt(settings.target_kcal)} kcal · protein ${fmtKg(nut.proteinG)} / ${settings.target_protein_g} g`);
    if (nut.proteinG < settings.target_protein_g * 0.8) {
      lines.push("   Protein kemarin kurang dari 80% target. Hari ini coba tambah telur, dada ayam, tempe, atau tahu di tiap makan.");
    }
  } else {
    lines.push("🍽️ Belum ada catatan makan kemarin. Kirim foto makanan ke sini biar kalori dan protein kehitung.");
  }

  // Pengingat timbang: tiap Minggu pagi, dan kalau sudah lama nggak timbang (>= 8 hari)
  const hariSejakTimbang = ukur[0] ? daysBetween(ukur[0].date, today) : null;
  const timbang = pengingatTimbang(today, hariSejakTimbang);
  const perluTimbang = timbang.perlu;
  lines.push(...timbang.baris);

  await ctx.send(lines.join("\n"), [
    [
      { text: "📱 Buka app", url: APP_URL },
      ...(perluTimbang ? [{ text: "⚖️ Catat timbangan", url: `${APP_URL}/badan` }] : []),
    ],
  ]);

  // Menu hari ini (atau pesan istirahat kalau weekend), lengkap dengan target beban dan tombolnya
  await handleBotInput({ text: "/hari_ini" }, ctx);
}
