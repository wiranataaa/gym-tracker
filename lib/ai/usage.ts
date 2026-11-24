import { db } from "../supabase.ts";

// Harga per 1 juta token (USD), dari daftar harga resmi Anthropic.
const PRICE: Record<string, { in: number; out: number }> = {
  "claude-sonnet-5-5": { in: 2, out: 10 },
  "claude-haiku-5-5": { in: 0.1, out: 0.5 },
  "claude-opus-5-5": { in: 4, out: 20 },
};

/** Catat pemakaian token dan perkiraan biaya supaya bulanan bisa dipantau. */
export async function logUsage(feature: string, model: string, inputTokens: number, outputTokens: number): Promise<void> {
  const p = PRICE[model] ?? PRICE["claude-sonnet-5-5"];
  const cost = (inputTokens * p.in + outputTokens * p.out) / 1_000_000;
  const { error } = await db().from("ai_usage_log").insert({
    feature,
    model,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    est_cost_usd: Math.round(cost * 1_000_000) / 1_000_000,
  });
  if (error) console.error("Gagal catat biaya AI:", error.message);
}
