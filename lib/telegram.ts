// Kirim pesan ke Telegram. TELEGRAM_DRY_RUN=1 -> cuma dicetak ke konsol (buat tes lokal).

export type Button = { text: string; data: string };
export type Keyboard = Button[][];

async function api(method: string, payload: object): Promise<{ ok: boolean; result?: { message_id?: number } }> {
  if (process.env.TELEGRAM_DRY_RUN === "1") {
    console.log(`[DRY-RUN ${method}]`, JSON.stringify(payload));
    return { ok: true, result: { message_id: 0 } };
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
    const json = (await res.json()) as { ok: boolean; description?: string; result?: { message_id?: number } };
    if (!json.ok) console.error(`Telegram ${method} gagal:`, json.description);
    return json;
  } catch (err) {
    console.error(`Telegram ${method} error:`, String(err));
    return { ok: false };
  }
}

function markup(keyboard?: Keyboard) {
  if (!keyboard || keyboard.length === 0) return undefined;
  return {
    inline_keyboard: keyboard.map((row) => row.map((b) => ({ text: b.text, callback_data: b.data }))),
  };
}

export async function sendMessage(chatId: number, text: string, keyboard?: Keyboard): Promise<void> {
  // Batas Telegram 4096 karakter per pesan
  await api("sendMessage", { chat_id: chatId, text: text.slice(0, 4000), reply_markup: markup(keyboard) });
}

export async function answerCallback(callbackQueryId: string, text?: string): Promise<void> {
  await api("answerCallbackQuery", { callback_query_id: callbackQueryId, text });
}
