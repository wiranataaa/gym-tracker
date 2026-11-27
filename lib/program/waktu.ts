// Rencana jam gym hari ini: pagi atau malam. Disimpan di daily_plans.plan ({ waktu_gym }).
// Murni kode, gampang dites.

export type WaktuGym = "pagi" | "malam";

export const sahWaktuGym = (w: unknown): w is WaktuGym => w === "pagi" || w === "malam";

/** Baca dari kolom plan (bentuk lama berupa array kosong, jadi aman kalau belum pernah dipilih). */
export function bacaWaktuGym(plan: unknown): WaktuGym | null {
  const w = (plan as { waktu_gym?: unknown } | null | undefined)?.waktu_gym;
  return sahWaktuGym(w) ? w : null;
}

export const PESAN_WAKTU: Record<WaktuGym, string> = {
  pagi: "☀️ Oke, gym pagi ini.",
  malam: "🌙 Oke, gym malam ini. Sekitar jam 19.00 gua ingetin di Telegram. Usahain beres ±2 jam sebelum tidur biar jam tidur nggak keganggu lagi.",
};
