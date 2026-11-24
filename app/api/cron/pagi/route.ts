import { timingSafeEqual } from "node:crypto";
import { pesanPagi } from "@/lib/bot/pagi.ts";
import { db } from "@/lib/supabase.ts";
import { sendMessage } from "@/lib/telegram.ts";
import { todayWIB } from "@/lib/time.ts";

// Dipanggil Vercel Cron tiap hari (lihat vercel.json: 30 22 * * * UTC = 05.30 WIB).
// Di paket gratis (Hobby) waktunya bisa bergeser di dalam jam itu (05.00-05.59 WIB).
export const maxDuration = 30;

function sama(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function GET(request: Request) {
  // Vercel mengirim "Authorization: Bearer <CRON_SECRET>" kalau CRON_SECRET diisi di Environment Variables
  const secret = process.env.CRON_SECRET ?? "";
  const auth = request.headers.get("authorization") ?? "";
  if (!secret || !sama(auth, `Bearer ${secret}`)) return new Response("Unauthorized", { status: 401 });

  const chatId = Number(process.env.TELEGRAM_CHAT_ID);
  if (!Number.isFinite(chatId)) return Response.json({ ok: false, error: "TELEGRAM_CHAT_ID kosong" }, { status: 500 });

  // Cegah kirim dobel di hari yang sama (cron bisa diulang): penanda pakai id negatif = -YYYYMMDD
  const today = todayWIB();
  const force = new URL(request.url).searchParams.get("force") === "1";
  const marker = -Number(today.replaceAll("-", ""));
  if (!force) {
    const { error } = await db().from("telegram_updates").insert({ update_id: marker });
    if (error) {
      if (error.code === "23505") return Response.json({ ok: true, skipped: "sudah terkirim hari ini" });
      console.error("Gagal catat penanda cron:", error.message);
    }
  }

  try {
    await pesanPagi({ send: (text, keyboard) => sendMessage(chatId, text, keyboard), today });
    return Response.json({ ok: true, sent: today });
  } catch (err) {
    console.error("Cron pagi gagal:", err);
    // Lepas penanda supaya percobaan berikutnya boleh kirim lagi
    if (!force) await db().from("telegram_updates").delete().eq("update_id", marker);
    return Response.json({ ok: false, error: "gagal kirim" }, { status: 500 });
  }
}
