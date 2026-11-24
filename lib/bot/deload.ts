import { PANDUAN_DELOAD } from "../program/deload.ts";
import { cekDeload } from "../report/deloadCek.ts";
import { tglLengkap, todayWIB } from "../time.ts";
import { akhiriDeload, mulaiDeload } from "../workout/db.ts";
import type { Ctx } from "./handlers.ts";

/** /deload [mulai|selesai]: lihat status dan saran, atau mulai/akhiri minggu deload. */
export async function perintahDeload(ctx: Ctx, arg: string): Promise<void> {
  const today = ctx.today ?? todayWIB();
  const a = arg.trim().toLowerCase();

  try {
    if (a === "mulai") {
      const sampai = await mulaiDeload(today);
      await ctx.send(`🔋 Minggu deload dimulai sampai ${tglLengkap(sampai)}.\n${PANDUAN_DELOAD}\nMenu hari ini otomatis jadi versi ringan. Kalau udah segar lebih cepat, ketik /deload selesai.`);
      return;
    }
    if (a === "selesai") {
      await akhiriDeload();
      await ctx.send("Deload diakhiri. Menu balik ke volume normal.");
      return;
    }
  } catch (err) {
    console.error("Deload gagal:", err);
    await ctx.send("Gagal mengubah mode deload. Kemungkinan migrasi database 008 belum dijalankan.");
    return;
  }

  const s = await cekDeload(today);
  if (s.aktif) {
    await ctx.send(`🔋 Deload lagi berjalan${s.sampai ? ` sampai ${tglLengkap(s.sampai)}` : ""}.\n${PANDUAN_DELOAD}\nAkhiri lebih cepat: /deload selesai`);
  } else if (s.perlu) {
    await ctx.send(`🔋 Disarankan deload (minggu ringan):\n${s.alasan.map((x) => `• ${x}`).join("\n")}\n\n${PANDUAN_DELOAD}`, [
      [{ text: "🔋 Mulai deload 7 hari", data: "dl:mulai" }, { text: "Nanti dulu", data: "dl:nanti" }],
    ]);
  } else {
    await ctx.send(`Belum perlu deload. Sistem nyaranin otomatis tiap ±7 minggu latihan, atau kalau performa turun di banyak gerakan 2 sesi berturut-turut.\nMau tetap deload sekarang? /deload mulai`);
  }
}

export async function callbackDeload(ctx: Ctx, data: string): Promise<boolean> {
  if (data === "dl:mulai") {
    await perintahDeload(ctx, "mulai");
    return true;
  }
  if (data === "dl:nanti") {
    await ctx.send("Oke, lanjut normal. Kalau terasa capek banget, ketik /deload mulai kapan aja.");
    return true;
  }
  return false;
}
