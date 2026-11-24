import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { db } from "../supabase.ts";

// Perkiraan kalori/protein dari foto atau teks makanan.
// AI cuma menebak gizi per item; penjumlahan dan progres dihitung kode (lib/nutrition/calc.ts).

export const MODEL = "claude-sonnet-5-5";
// Harga per 1 juta token (USD) buat catatan biaya. Sumber: daftar harga resmi Anthropic.
const PRICE_IN = 2;
const PRICE_OUT = 10;

const Item = z.object({
  nama: z.string().describe("Nama makanan dalam bahasa Indonesia, spesifik (mis. 'Ayam bakar paha')"),
  porsi_g: z.number().describe("Perkiraan berat porsi dalam gram (matang/siap makan)"),
  kcal: z.number().describe("Kalori item ini TERMASUK minyak, santan, gula, dan saus yang nggak kelihatan"),
  protein_g: z.number(),
  karbo_g: z.number(),
  lemak_g: z.number(),
  catatan: z.string().describe("Asumsi singkat, mis. 'digoreng, minyak ±1 sdm'. Kosongkan kalau nggak perlu"),
});

export const Estimasi = z.object({
  ada_makanan: z.boolean().describe("false kalau gambar/teks bukan makanan atau minuman"),
  ringkasan: z
    .string()
    .describe("NAMA SINGKAT makan ini, maksimal 6 kata, tanpa titik/kalimat. Contoh: 'Nasi + ayam bakar + tempe', 'Soto ayam + nasi'"),
  item: z.array(Item),
  kcal_min: z.number().describe("Batas bawah total kalori yang masuk akal"),
  kcal_max: z.number().describe("Batas atas total kalori yang masuk akal"),
  keyakinan: z.enum(["rendah", "sedang", "tinggi"]),
  pertanyaan: z.string().describe("Satu pertanyaan singkat soal porsi/bahan kalau ragu, kalau nggak kosongkan"),
});

export type EstimasiData = z.infer<typeof Estimasi>;

export type EstimateResult =
  | { ok: true; data: EstimasiData; model: string; inputTokens: number; outputTokens: number }
  | { ok: false; reason: string };

const SYSTEM = `Kamu ahli gizi yang menebak kalori dan makro dari foto atau deskripsi makanan, untuk satu orang dewasa yang lagi lean bulk dan rutin ke gym.

Aturan:
- Paham makanan Indonesia: nasi putih/padang/goreng, ayam geprek/bakar/goreng, rendang, soto, gado-gado, pecel, bakso, mie ayam, gorengan, tempe, tahu, telur, sayur warteg, dll.
- SELALU hitung minyak goreng, santan, gula, kecap, sambal, dan saus yang nggak kelihatan. Makanan Indonesia hampir selalu lebih tinggi kalorinya dari kelihatannya.
- Pecah makanan jadi item terpisah (nasi, lauk, sayur, minuman) dengan berat dalam gram. Pakai berat matang/siap makan.
- Jangan mengarang item yang nggak kelihatan atau nggak disebut, kecuali minyak/santan/saus yang memang pasti ada di masakan itu.
- Kalau porsi nggak jelas, pilih perkiraan paling mungkin, lebarkan rentang kcal_min dan kcal_max, turunkan keyakinan, dan isi 'pertanyaan' satu kalimat.
- Kalau yang dikirim bukan makanan atau minuman, set ada_makanan=false dan kosongkan item.
- Semua teks dalam bahasa Indonesia santai, singkat.`;

const client = () => new Anthropic({ timeout: 25_000, maxRetries: 1 });

async function logUsage(feature: string, inputTokens: number, outputTokens: number): Promise<void> {
  const cost = (inputTokens * PRICE_IN + outputTokens * PRICE_OUT) / 1_000_000;
  const { error } = await db().from("ai_usage_log").insert({
    feature,
    model: MODEL,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    est_cost_usd: Math.round(cost * 1_000_000) / 1_000_000,
  });
  if (error) console.error("Gagal catat biaya AI:", error.message);
}

async function ask(content: Anthropic.MessageParam["content"], feature: string): Promise<EstimateResult> {
  try {
    const response = await client().messages.parse({
      model: MODEL,
      max_tokens: 4000,
      system: SYSTEM,
      output_config: { effort: "low", format: zodOutputFormat(Estimasi) },
      messages: [{ role: "user", content }],
    });

    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    await logUsage(feature, inputTokens, outputTokens);

    if (response.stop_reason === "refusal") return { ok: false, reason: "AI menolak memproses ini. Coba foto atau teks lain." };
    if (response.stop_reason === "max_tokens") return { ok: false, reason: "Jawaban AI kepotong. Coba lagi." };
    if (!response.parsed_output) return { ok: false, reason: "Jawaban AI nggak bisa dibaca. Coba lagi." };

    return { ok: true, data: response.parsed_output, model: MODEL, inputTokens, outputTokens };
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return { ok: false, reason: "AI lagi kena batas request. Coba lagi sebentar." };
    if (err instanceof Anthropic.AuthenticationError) return { ok: false, reason: "API key Claude bermasalah (cek di Vercel)." };
    if (err instanceof Anthropic.APIError) {
      // Saldo habis dikembalikan sebagai 400 invalid_request dengan pesan soal credit
      if (/credit|balance/i.test(err.message)) return { ok: false, reason: "Saldo kredit Anthropic habis. Isi ulang di Console." };
      console.error("Claude API error:", err.status, err.message);
      return { ok: false, reason: "AI lagi error. Coba lagi sebentar." };
    }
    console.error("Error AI:", err);
    return { ok: false, reason: "AI lagi error. Coba lagi sebentar." };
  }
}

export type ImageType = "image/jpeg" | "image/png" | "image/webp";

export async function estimateFromPhoto(base64: string, mediaType: ImageType, caption?: string): Promise<EstimateResult> {
  const text = caption?.trim()
    ? `Perkirakan kalori dan gizi makanan di foto ini. Keterangan dari pemilik: "${caption.trim()}"`
    : "Perkirakan kalori dan gizi makanan di foto ini.";
  return ask(
    [
      { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
      { type: "text", text },
    ],
    "nutrisi_foto",
  );
}

export async function estimateFromText(deskripsi: string): Promise<EstimateResult> {
  return ask(`Perkirakan kalori dan gizi dari makanan ini (satu kali makan): ${deskripsi.trim().slice(0, 500)}`, "nutrisi_teks");
}
