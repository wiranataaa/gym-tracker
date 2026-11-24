import { timingSafeEqual } from "node:crypto";
import { laporanMingguan, pengingatProtein, pengingatSuplemen } from "@/lib/bot/malam.ts";
import { db } from "@/lib/supabase.ts";
import { sendMessage } from "@/lib/telegram.ts";
import { todayWIB } from "@/lib/time.ts";

// Dipanggil Vercel Cron tiap hari (vercel.json: 0 12 * * * UTC = 19.00 WIB; di paket gratis bisa
// bergeser di dalam jam itu). Isi: pengingat protein, dan di hari Minggu juga laporan mingguan.
export const maxDuration = 60;

function sama(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  const auth = request.headers.get("authorization") ?? "";
  if (!secret || !sama(auth, `Bearer ${secret}`)) return new Response("Unauthorized", { status: 401 });

  const chatId = Number(process.env.TELEGRAM_CHAT_ID);
  if (!Number.isFinite(chatId)) return Response.json({ ok: false, error: "TELEGRAM_CHAT_ID kosong" }, { status: 500 });

  const today = todayWIB();
  const force = new URL(request.url).searchParams.get("force") === "1";

  // Penanda anti-dobel (id negatif unik per hari, beda dari penanda pesan pagi)
  const marker = -(Number(today.replaceAll("-", "")) * 10 + 1);
  if (!force) {
    const { error } = await db().from("telegram_updates").insert({ update_id: marker });
    if (error) {
      if (error.code === "23505") return Response.json({ ok: true, skipped: "sudah terkirim hari ini" });
      console.error("Gagal catat penanda cron malam:", error.message);
    }
  }

  const ctx = { send: (text: string, keyboard?: Parameters<typeof sendMessage>[2]) => sendMessage(chatId, text, keyboard), today };
  const hasil: Record<string, unknown> = {};
  try {
    hasil.protein = await pengingatProtein(ctx);
    hasil.suplemen = await pengingatSuplemen(ctx);
    hasil.laporan = await laporanMingguan(ctx, { tulis: true });
    return Response.json({ ok: true, today, ...hasil });
  } catch (err) {
    console.error("Cron malam gagal:", err);
    if (!force) await db().from("telegram_updates").delete().eq("update_id", marker);
    return Response.json({ ok: false, error: "gagal kirim", ...hasil }, { status: 500 });
  }
}
