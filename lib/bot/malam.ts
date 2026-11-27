import { ambilKonsistensi } from "../konsistensi/db.ts";
import { persen } from "../nutrition/calc.ts";
import { dayTotals } from "../nutrition/db.ts";
import { labelOpsi, saranProtein } from "../nutrition/saran.ts";
import { belumDiminum, listSuplemen } from "../suplemen/db.ts";
import { fmtInt, fmtKg, isoWeekday, todayWIB } from "../time.ts";
import { getSettings } from "../workout/db.ts";
import { formatLaporan, hitungLaporan, laporanSudahAda, simpanDanTerapkan } from "../report/mingguan.ts";
import type { Ctx } from "./handlers.ts";
import { APP_URL } from "./pagi.ts";

/** Di bawah ini (persen dari target protein), pengingat dikirim. */
export const AMBANG_PROTEIN = 0.9;

/**
 * Pengingat protein malam. Hanya dikirim kalau protein hari ini masih di bawah 90% target.
 * Saran makanan dihitung kode (bukan AI). Mengembalikan true kalau ada pesan terkirim.
 */
export async function pengingatProtein(ctx: Ctx): Promise<boolean> {
  const today = ctx.today ?? todayWIB();
  const [t, s] = await Promise.all([dayTotals(today), getSettings()]);

  if (t.count === 0) {
    await ctx.send(
      `🍽️ Belum ada catatan makan hari ini. Target: ${fmtInt(s.target_kcal)} kcal · protein ${s.target_protein_g} g.\nKirim foto makanan ke sini atau catat dari favorit di app.`,
      [[{ text: "🍽️ Buka Nutrisi", url: `${APP_URL}/nutrisi` }]],
    );
    return true;
  }
  if (t.proteinG >= s.target_protein_g * AMBANG_PROTEIN) return false;

  const kurang = Math.round(s.target_protein_g - t.proteinG);
  // Whey milik Nata (kalau sudah diatur di app) dipakai menggantikan nilai umum
  const whey = (await listSuplemen(true)).find((x) => /whey/i.test(x.name) && x.proteinG > 0);
  const saran = saranProtein(kurang, { whey: whey ? { proteinG: whey.proteinG, kcal: whey.kcal } : undefined });
  const lines: string[] = [
    `🥚 Pengingat protein`,
    `Protein hari ini ${fmtKg(t.proteinG)} / ${s.target_protein_g} g (${persen(t.proteinG, s.target_protein_g)}%) — kurang ±${kurang} g.`,
    `Kalori ${fmtInt(t.kcal)} / ${fmtInt(s.target_kcal)} kcal.`,
    "",
  ];

  if (saran.terlaluBanyak) lines.push(`Kekurangannya cukup besar. Kejar sekitar ${saran.tunggal[0]?.proteinG ?? 70} g dulu, sisanya besok jangan ketinggalan:`);
  else lines.push("Cara nutup sisanya:");

  for (const o of saran.tunggal) lines.push(`• ${labelOpsi(o)}`);
  if (saran.campuran) {
    lines.push("");
    lines.push(`Atau campur: ${saran.campuran.map(labelOpsi).join(" + ")}`);
  }
  lines.push("", "Nilai gizi di atas perkiraan umum, sesuaikan porsinya. Habis makan, catat lewat foto biar progresnya kehitung.");

  await ctx.send(lines.join("\n"), [[{ text: "🍽️ Buka Nutrisi", url: `${APP_URL}/nutrisi` }]]);
  return true;
}

/**
 * Colekan sore: pengingat gym malam kalau Nata menjadwalkannya, atau colekan anti-bolos (hari latihan,
 * belum ada sesi, jatah minggu belum penuh). Diam kalau sudah latihan, lagi latihan, atau di-skip.
 */
export async function colekanLatihan(ctx: Ctx): Promise<boolean> {
  const today = ctx.today ?? todayWIB();
  const { malam } = await ambilKonsistensi(today);
  if (!malam) return false;
  // Pengingat rencana sudah punya ikon sendiri; colekan biasa diberi 💢
  await ctx.send(malam.startsWith("🌙") ? malam : `💢 ${malam}`, [[{ text: "💪 Buka app, mulai", url: APP_URL }]]);
  return true;
}

/** Pengingat suplemen (creatine) kalau belum dicatat hari ini, dengan tombol sekali tap. */
export async function pengingatSuplemen(ctx: Ctx): Promise<boolean> {
  const today = ctx.today ?? todayWIB();
  const belum = await belumDiminum(today);
  if (belum.length === 0) return false;
  await ctx.send(
    `💊 Belum tercatat hari ini: ${belum.map((s) => `${s.name} (${s.doseDesc})`).join(", ")}. Kalau udah diminum, tap tombol di bawah.`,
    [belum.map((s) => ({ text: `✅ ${s.name.split(" ")[0]} udah`, data: `sp:${s.id}` }))],
  );
  return true;
}

/**
 * Laporan mingguan, dikirim di hari Minggu. Aman dipanggil ulang: kalau minggu itu sudah pernah dibuat, dilewati.
 * `tulis: false` = cuma menghitung dan mengirim (buat uji), tanpa menyimpan atau mengubah target kalori.
 */
export async function laporanMingguan(ctx: Ctx, opts: { tulis: boolean } = { tulis: true }): Promise<"terkirim" | "sudah_ada" | "bukan_minggu"> {
  const today = ctx.today ?? todayWIB();
  if (isoWeekday(today) !== 7) return "bukan_minggu";
  if (opts.tulis && (await laporanSudahAda(today))) return "sudah_ada";

  const laporan = await hitungLaporan(today);
  let teks = formatLaporan(laporan);

  if (opts.tulis) {
    const ok = await simpanDanTerapkan(laporan, teks);
    if (!ok && laporan.kalori.berubah) teks += "\n\n(Perubahan target kalori ditunda: tabel laporan belum siap.)";
  }
  await ctx.send(teks, [[{ text: "📱 Buka app", url: APP_URL }]]);
  return "terkirim";
}
