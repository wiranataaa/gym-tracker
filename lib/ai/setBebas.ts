import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { logUsage } from "./usage.ts";

// Mengubah kalimat bebas ("tadi bench 60 kilo 10 kali 3 set") jadi data set. Cuma dipakai kalau format
// cepat (bench 60x10x3) nggak terbaca. Hasilnya SELALU dikonfirmasi Nata dulu sebelum disimpan.
// Model kecil dan murah (Haiku) cukup untuk tugas sependek ini.

export const MODEL = "claude-haiku-5-5";

const Hasil = z.object({
  jenis: z
    .enum(["set_latihan", "makanan", "lainnya"])
    .describe("set_latihan = laporan satu gerakan angkat beban; makanan = pesan yang menceritakan makanan/minuman yang dimakan (mis. 'tadi makan pizza 2 potong'); lainnya = selain itu"),
  gerakan: z.string().describe("Nama gerakan PERSIS salah satu dari DAFTAR GERAKAN, atau string kosong kalau nggak ada yang cocok"),
  beban_kg: z.number().nullable().describe("Beban dalam kg; 0 untuk gerakan berat badan sendiri; null kalau nggak disebut"),
  reps: z.array(z.number()).describe("Jumlah reps per set, satu angka per set. '3 set 10 kali' = [10,10,10]"),
  rpe: z.number().nullable(),
  pemanasan: z.boolean().describe("true kalau disebut pemanasan / warm up"),
});

export type TebakanSet = { gerakan: string; bebanKg: number; reps: number[]; rpe: number | null; pemanasan: boolean };

export type HasilTebakSet = { ok: true; set: TebakanSet } | { ok: false; alasan: "bukan_set" | "makanan" | "tidak_jelas" | "error" };

const SYSTEM = `Kamu membaca pesan singkat berbahasa Indonesia santai dari seseorang yang sedang angkat beban. Pertama tentukan jenis pesannya: set_latihan (laporan satu gerakan angkat beban), makanan (menceritakan makanan atau minuman yang dia makan atau minum, mis. "tadi makan pizza 2 potong", "sarapan nasi uduk"), atau lainnya. Kalau set_latihan, ubah jadi data satu gerakan.

Aturan:
- Pilih nama gerakan HANYA dari DAFTAR GERAKAN yang diberikan (tulis persis). Kalau nggak ada yang cocok, kosongkan.
- "kilo", "kg", "kiloan" = kilogram. "3 set 10 kali", "3x10", "10 reps 3 set" = reps [10,10,10]. "10, 9, 8" = [10,9,8].
- Jangan mengarang. Kalau beban atau jumlah reps nggak disebut jelas, isi null/kosongkan.
- Kalau pesannya menceritakan makanan atau minuman, jenis = makanan (isi field lain sekenanya). Kalau obrolan biasa atau pertanyaan, jenis = lainnya.`;

export type GerakanDaftar = { nama: string; bodyweight: boolean };

export async function tebakSetBebas(teks: string, daftar: GerakanDaftar[]): Promise<HasilTebakSet> {
  const namaGerakan = daftar.map((d) => d.nama);
  try {
    const client = new Anthropic({ timeout: 20_000, maxRetries: 1 });
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 1000,
      system: SYSTEM,
      output_config: { effort: "low", format: zodOutputFormat(Hasil) },
      messages: [{ role: "user", content: `DAFTAR GERAKAN:\n${namaGerakan.map((n) => `- ${n}`).join("\n")}\n\nPESAN:\n${teks.slice(0, 300)}` }],
    });
    await logUsage("set_kalimat_bebas", MODEL, response.usage.input_tokens, response.usage.output_tokens);

    const h = response.parsed_output;
    if (!h || response.stop_reason === "refusal") return { ok: false, alasan: "error" };
    if (h.jenis === "makanan") return { ok: false, alasan: "makanan" };
    if (h.jenis !== "set_latihan") return { ok: false, alasan: "bukan_set" };

    // Penjaga kode: gerakan harus ada di daftar, beban dan reps harus masuk akal
    const cocok = daftar.find((d) => d.nama.toLowerCase() === h.gerakan.trim().toLowerCase());
    const reps = h.reps.map((r) => Math.round(r));
    // Gerakan berat badan sendiri (hanging leg raise, dll.) memang nggak punya beban: anggap 0
    const beban = h.beban_kg ?? (cocok?.bodyweight ? 0 : null);
    if (!cocok || beban == null || !(beban >= 0 && beban <= 500)) return { ok: false, alasan: "tidak_jelas" };
    if (reps.length < 1 || reps.length > 10 || reps.some((r) => !(r >= 1 && r <= 100))) return { ok: false, alasan: "tidak_jelas" };
    if (h.rpe != null && !(h.rpe >= 1 && h.rpe <= 10)) return { ok: false, alasan: "tidak_jelas" };

    return { ok: true, set: { gerakan: cocok.nama, bebanKg: beban, reps, rpe: h.rpe, pemanasan: h.pemanasan } };
  } catch (err) {
    console.error("Tebak set gagal:", err instanceof Anthropic.APIError ? `${err.status} ${err.message}` : String(err));
    return { ok: false, alasan: "error" };
  }
}
