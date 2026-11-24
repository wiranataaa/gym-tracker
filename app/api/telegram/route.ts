import { timingSafeEqual } from "node:crypto";
import { after } from "next/server";
import { handleBotInput, type Ctx } from "@/lib/bot/handlers.ts";
import { db } from "@/lib/supabase.ts";
import { answerCallback, downloadFile, editMessage, sendMessage } from "@/lib/telegram.ts";

// Batas waktu fungsi (detik). Foto + panggilan Claude bisa belasan detik.
export const maxDuration = 60;

type TelegramUpdate = {
  update_id: number;
  message?: {
    chat: { id: number };
    text?: string;
    caption?: string;
    photo?: { file_id: string; file_size?: number; width: number; height: number }[];
  };
  callback_query?: { id: string; data?: string; message?: { message_id: number; chat: { id: number } } };
};

function sameSecret(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

// Cek cepat dari browser: buka /api/telegram, harusnya muncul {"ok":true}
export async function GET() {
  return Response.json({ ok: true });
}

export async function POST(request: Request) {
  // 1. Pastikan yang kirim beneran Telegram (secret_token dari setWebhook)
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET ?? "";
  const header = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!secret || !sameSecret(header, secret)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const update = (await request.json()) as TelegramUpdate;
  const chatId = update.message?.chat.id ?? update.callback_query?.message?.chat.id;
  if (chatId == null) return Response.json({ ok: true });

  // 2. Whitelist: cuma chat_id Nata yang dilayani, yang lain diabaikan
  if (String(chatId) !== process.env.TELEGRAM_CHAT_ID) {
    return Response.json({ ok: true });
  }

  // 3. Idempoten: Telegram bisa kirim ulang update yang sama, jangan diproses dua kali
  const { error: dupError } = await db().from("telegram_updates").insert({ update_id: update.update_id });
  if (dupError) {
    if (dupError.code === "23505") return Response.json({ ok: true, duplicate: true });
    console.error("Gagal catat update_id:", dupError.message);
  }

  const callbackMessageId = update.callback_query?.message?.message_id;
  const ctx: Ctx = {
    send: (text, keyboard) => sendMessage(chatId, text, keyboard),
    edit: callbackMessageId ? (text, keyboard) => editMessage(chatId, callbackMessageId, text, keyboard) : undefined,
    downloadPhoto: downloadFile,
  };

  // Foto terbesar = elemen terakhir
  const photo = update.message?.photo?.slice().sort((a, b) => (a.file_size ?? a.width * a.height) - (b.file_size ?? b.width * b.height)).pop();

  // 4. Balas 200 ke Telegram dulu, kerjaannya (bisa belasan detik kalau ada AI) jalan setelahnya
  after(async () => {
    try {
      if (update.callback_query) {
        await answerCallback(update.callback_query.id);
        await handleBotInput({ callbackData: update.callback_query.data }, ctx);
      } else if (photo) {
        await handleBotInput({ photoFileId: photo.file_id, caption: update.message?.caption }, ctx);
      } else {
        await handleBotInput({ text: update.message?.text }, ctx);
      }
    } catch (err) {
      console.error("Error handler bot:", err);
      await sendMessage(chatId, "Waduh, ada error di sisi gua 😅 Coba lagi sebentar. Kalau berulang, kabarin Claude Code.");
    }
  });

  return Response.json({ ok: true });
}
