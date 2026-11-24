import { timingSafeEqual } from "node:crypto";

// Endpoint sekali pakai buat memasang webhook Telegram dari server Vercel.
// Dilindungi secret yang sama dengan webhook. Boleh dihapus setelah terpasang.
export const maxDuration = 30;

function sameSecret(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

async function telegram(method: string, payload?: object) {
  const res = await fetch(
    `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload ?? {}),
    },
  );
  return res.json();
}

export async function POST(request: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET ?? "";
  const header = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!secret || !sameSecret(header, secret)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const webhookUrl = `${new URL(request.url).origin}/api/telegram`;

  const me = await telegram("getMe");
  const set = await telegram("setWebhook", {
    url: webhookUrl,
    secret_token: secret,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  });
  const info = await telegram("getWebhookInfo");

  // Token bot tidak pernah ditampilkan; hanya ringkasan hasil.
  return Response.json({
    bot: me.ok ? { username: me.result.username } : me,
    setWebhook: set,
    webhook: info.ok
      ? {
          url: info.result.url,
          pending_update_count: info.result.pending_update_count,
          last_error_message: info.result.last_error_message ?? null,
        }
      : info,
  });
}
