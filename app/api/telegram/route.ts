import { timingSafeEqual } from "node:crypto";

// Batas waktu fungsi (detik). Nanti dipakai juga buat proses foto + Claude.
export const maxDuration = 30;

type TelegramUpdate = {
  update_id: number;
  message?: {
    chat: { id: number };
    text?: string;
  };
};

function sameSecret(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

async function kirimPesan(chatId: number, text: string) {
  await fetch(
    `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    },
  );
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
  const message = update.message;
  if (!message) return Response.json({ ok: true });

  // 2. Whitelist: cuma chat_id Nata yang dilayani, yang lain diabaikan
  if (String(message.chat.id) !== process.env.TELEGRAM_CHAT_ID) {
    return Response.json({ ok: true });
  }

  // 3. Balasan sementara (fitur sebenarnya dibangun di Fase 1)
  const teks = message.text?.trim() ?? "";
  if (teks === "/start") {
    await kirimPesan(
      message.chat.id,
      "Halo Nata! 💪 Bot Gym Tracker udah nyala dan nyambung ke server. Fitur lengkapnya nyusul di Fase 1.",
    );
  } else {
    await kirimPesan(message.chat.id, "Gua dengar lo 👍 (fitur ini belum dibuat)");
  }

  return Response.json({ ok: true });
}
