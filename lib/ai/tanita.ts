import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { KomposisiBaca } from "../body/tanitaValid.ts";
import type { ImageType } from "./nutrition.ts";
import { logUsage } from "./usage.ts";

// Membaca foto/screenshot layar app Tanita RD-953AS. AI cuma MEMBACA angka; penilaian masuk akal
// atau tidak dilakukan kode (lib/body/tanitaValid.ts) dan hasilnya selalu dikonfirmasi dulu.

export const MODEL = "claude-sonnet-5-5";

const Hasil = z.object({
  terbaca: z.boolean().describe("false kalau gambar ini bukan layar hasil timbangan komposisi badan Tanita"),
  tanggal: z.string().describe("Tanggal di bagian atas layar format YYYY-MM-DD, atau string kosong kalau nggak ada"),
  jam: z.string().describe("Jam di kolom Time format HH:MM, atau string kosong"),
  berat_kg: z.number().nullable(),
  body_fat_pct: z.number().nullable(),
  muscle_mass_kg: z.number().nullable(),
  muscle_score: z.number().nullable(),
  bmi: z.number().nullable(),
  muscle_quality: z.number().nullable(),
  visceral_fat: z.number().nullable(),
  bone_mass_kg: z.number().nullable(),
  body_water_pct: z.number().nullable(),
  bmr_kcal: z.number().nullable(),
  metabolic_age: z.number().nullable(),
  catatan: z.string().describe("Hal yang meragukan saat membaca (angka buram, terpotong, dll), atau string kosong"),
});

export type HasilBacaTanita = { ok: true; data: KomposisiBaca; catatan: string } | { ok: false; reason: string };

const SYSTEM = `Kamu membaca screenshot atau foto layar HP yang menampilkan hasil timbangan Tanita RD-953AS (halaman "Body Comp" di app Tanita). Tugasmu hanya menyalin angka, tanpa menilai.

PENTING — layar app ini MENAMPILKAN NILAI BERGESER SATU BARIS KE BAWAH dari label-nya. Label ada di sisi kiri dan nilai di sisi kanan, tapi nilai sebuah label muncul sejajar dengan label di BAWAHNYA. Jadi JANGAN mencocokkan angka dengan label yang sejajar. Cara yang benar: baca semua NILAI di kolom kanan dari atas ke bawah, lalu petakan berurutan ke daftar metrik berikut:

1. Time (jam, mis. 17:52)
2. Weight (kg)
3. Body Fat %
4. Muscle Mass (kg)
5. Muscle Score (angka kecil, sering 0)
6. BMI
7. Muscle Quality
8. Visc. Fat Lv (visceral fat)
9. Bone Mass (kg)
10. Body Water %
11. BMR (kcal)
12. Metabolic Age (age)

Satuan membantu memastikan urutan: nilai ke-2 berakhiran kg (berat), ke-3 berakhiran %, ke-4 berakhiran kg, ke-9 berakhiran kg, ke-10 berakhiran %, ke-11 kcal, ke-12 age. Lencana kecil berwarna (Healthy, Average, dst.) hanya penilaian, abaikan. Kalau sebuah nilai benar-benar nggak terbaca, isi null jangan menebak. Kalau gambar bukan layar Tanita, set terbaca=false.`;

const nilai = (n: number | null): number | null => (n == null || !Number.isFinite(n) ? null : n);

export async function bacaTanita(base64: string, mediaType: ImageType): Promise<HasilBacaTanita> {
  try {
    const client = new Anthropic({ timeout: 40_000, maxRetries: 1 });
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 3000,
      system: SYSTEM,
      output_config: { effort: "low", format: zodOutputFormat(Hasil) },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
            { type: "text", text: "Baca hasil timbangan Tanita di gambar ini." },
          ],
        },
      ],
    });
    await logUsage("tanita_foto", MODEL, response.usage.input_tokens, response.usage.output_tokens);

    if (response.stop_reason === "refusal") return { ok: false, reason: "AI menolak memproses gambar ini." };
    if (!response.parsed_output) return { ok: false, reason: "Jawaban AI nggak bisa dibaca. Coba lagi." };
    const h = response.parsed_output;
    if (!h.terbaca) return { ok: false, reason: "Itu kayaknya bukan layar hasil timbangan Tanita. Kirim screenshot halaman Body Comp." };

    return {
      ok: true,
      catatan: h.catatan,
      data: {
        tanggal: h.tanggal || null,
        jam: h.jam || null,
        beratKg: nilai(h.berat_kg),
        bodyFatPct: nilai(h.body_fat_pct),
        muscleMassKg: nilai(h.muscle_mass_kg),
        muscleScore: nilai(h.muscle_score),
        bmi: nilai(h.bmi),
        muscleQuality: nilai(h.muscle_quality),
        visceralFat: nilai(h.visceral_fat),
        boneMassKg: nilai(h.bone_mass_kg),
        bodyWaterPct: nilai(h.body_water_pct),
        bmrKcal: nilai(h.bmr_kcal),
        metabolicAge: nilai(h.metabolic_age),
      },
    };
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return { ok: false, reason: "AI lagi kena batas request. Coba lagi sebentar." };
    if (err instanceof Anthropic.APIError) {
      if (/credit|balance/i.test(err.message)) return { ok: false, reason: "Saldo kredit Anthropic habis. Isi ulang di Console." };
      console.error("Tanita API error:", err.status, err.message);
    } else {
      console.error("Tanita error:", err);
    }
    return { ok: false, reason: "AI lagi error. Coba lagi sebentar." };
  }
}
