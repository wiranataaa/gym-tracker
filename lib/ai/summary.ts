import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { db, must } from "../supabase.ts";
import { angkaTurunan, buildSummaryInput, type SummaryInput } from "../workout/summaryData.ts";
import { logUsage } from "./usage.ts";
import { angkaTidakDikenal } from "./validasi.ts";

// Kesimpulan latihan harian. Kode menghitung SEMUA angka (lib/workout/summaryData.ts);
// AI hanya menuliskan penjelasan, dan teksnya diperiksa supaya nggak ada angka karangan.

export const MODEL = "claude-sonnet-5-5";

const Kesimpulan = z.object({
  berubah: z.string().describe("Apa yang berubah dibanding sesi sebelumnya. Maks 2 kalimat, sebut gerakan dan angka dari data."),
  pertahankan: z.string().describe("Apa yang perlu dipertahankan. Maks 2 kalimat."),
  perbaiki: z.array(z.string()).describe("1-2 poin konkret yang perlu diperbaiki. Kalau memang nggak ada, satu poin kecil yang realistis."),
  nutrisi: z.string().describe("Status nutrisi hari ini dari data. Maks 2 kalimat."),
  tidur: z
    .string()
    .describe("Tidur dan istirahat: jam tidur, jam bangun, durasi, jam gym, dan apakah istirahatnya cukup, dari data. Maks 3 kalimat. Kalau data tidur null, bilang belum dicatat dan ajak catat besok pagi."),
  besok: z.string().describe("Gambaran besok (latihan apa atau istirahat). Maks 1-2 kalimat."),
});
type KesimpulanData = z.infer<typeof Kesimpulan>;

const SYSTEM = `Kamu teman gym yang paham data, menulis kesimpulan latihan harian untuk Nata (27 tahun, lagi lean bulk, target naik berat badan pelan-pelan).

Aturan keras:
- Pakai HANYA angka yang ada di DATA. Jangan menghitung, menebak, atau membulatkan angka baru. Kalau mau bilang selisih, hanya kalau selisihnya jelas dari dua angka di data.
- Jangan mengklaim hal yang nggak ada di data: soal teknik/form, rasa di otot, stres, atau niat. Kamu cuma tahu isi DATA.
- Bahasa Indonesia santai, singkat, langsung ke inti. Sebut nama gerakan dan angka spesifik.
- Jujur: kalau stagnan atau rep turun, bilang jelas plus satu saran konkret. Jangan motivasi generik yang nggak nyambung ke data.
- Kalau jumlah_makan_tercatat = 0, bilang belum ada catatan makan hari ini, jangan menebak kalori.
- Kalau energi 1-2, kaitkan ke performa dengan hati-hati (jangan menyalahkan). Kalau mode "singkat", hargai bahwa tetap datang.
- Tidak memberi saran medis. Kalau ada kata nyeri/cedera di data, sarankan istirahatkan bagian itu dan konsultasi ke tenaga kesehatan kalau berlanjut.
- Beban di gym ini kelipatan 2 kg.
- "gerakan_dilewati" = gerakan yang sisa setnya sengaja Nata lewati (bisa karena capek atau alatnya penuh; alasannya NGGAK diketahui, jangan ditebak). Sebut apa adanya tanpa menyalahkan.
- "gerakan_diganti" = gerakan yang ditukar dengan gerakan lain di sesi ini (biasanya alatnya penuh). Itu bukan kekurangan; jangan bandingkan beban gerakan pengganti dengan gerakan yang diganti.
- Soal tidur, pakai HANYA bagian "tidur" dan "jam_gym" di DATA. Tulis jam persis seperti di data (format HH:MM, contoh 23:30), jangan menulis ulang jadi "jam 11 malam". Sebut jam tidur, jam bangun, durasi, dan jam gym. Nilai cukup/kurang dari field "status" dan durasi_jam dibanding target_jam; jangan bikin patokan sendiri.
- Kalau tidur kurang (status "kurang" atau "agak_kurang"), kaitkan ke performa/energi hari itu dengan hati-hati: itu kemungkinan, bukan kepastian. Kalau tidur cukup tapi performa turun, jangan menyalahkan tidur.
- "catatan_nata" adalah cerita Nata sendiri soal tidurnya; boleh dikutip singkat. Kalau dia cerita sering susah tidur, kasih satu saran tidur umum yang ringan (jam tidur konsisten, kurangi layar sebelum tidur), bukan saran medis.
- Kalau ada "tidur_lain", hari itu Nata tidur lebih dari sekali: durasi_jam dan durasi_teks sudah TOTAL; jam_tidur/jam_bangun itu tidur yang terlama.
- Kalau tidur null, JANGAN menebak jam tidur atau durasinya.`;

function formatKesimpulan(hari: string, k: KesimpulanData): string {
  return [
    `🧠 Kesimpulan ${hari}`,
    "",
    "📈 Yang berubah",
    k.berubah,
    "",
    "✅ Pertahankan",
    k.pertahankan,
    "",
    "🔧 Perbaiki",
    ...k.perbaiki.slice(0, 2).map((p) => `• ${p}`),
    "",
    "🍽️ Nutrisi",
    k.nutrisi,
    "",
    "😴 Tidur & istirahat",
    k.tidur,
    "",
    "➡️ Besok",
    k.besok,
  ].join("\n");
}

const kg = (n: number) => String(n).replace(".", ",");

/** Kalimat tidur murni dari data (dipakai di cadangan tanpa AI). */
export function tidurCadangan(i: SummaryInput): string {
  const t = i.tidur;
  const gym = `Gym mulai ${i.jam_gym.mulai}${i.jam_gym.selesai ? `, selesai ${i.jam_gym.selesai}` : ""}.`;
  if (!t) return `Tidur semalam belum dicatat. ${gym} Catat besok pagi ya (app atau /tidur 23:30 6:00) biar kelihatan istirahatmu cukup atau nggak.`;
  const status = t.status === "cukup" ? "cukup" : t.status === "agak_kurang" ? "agak kurang" : "kurang";
  const cerita = t.catatan_nata ? ` Katamu: “${t.catatan_nata}”.` : "";
  const jam = t.tidur_lain?.length
    ? `Tidur ${[{ jam_tidur: t.jam_tidur, jam_bangun: t.jam_bangun }, ...t.tidur_lain].map((x) => `${x.jam_tidur} sampai ${x.jam_bangun}`).join(" dan ")}, total ${t.durasi_teks}`
    : `Tidur ${t.jam_tidur} sampai bangun ${t.jam_bangun} (${t.durasi_teks})`;
  return `${jam}, ${status} dari target ${t.target_jam} jam. ${gym}${cerita}`;
}

/** Cadangan tanpa AI kalau panggilan gagal atau angkanya ketahuan mengarang. Murni dari data. */
export function kesimpulanCadangan(i: SummaryInput): KesimpulanData {
  const naik = i.gerakan.filter((g) => g.perbandingan === "beban_naik" || g.perbandingan === "rep_naik");
  const turun = i.gerakan.filter((g) => g.perbandingan === "rep_turun" || g.perbandingan === "lebih_ringan");
  const pr = i.gerakan.filter((g) => g.pr);
  const n = i.nutrisi_hari_ini;

  return {
    berubah:
      naik.length > 0
        ? `Naik di ${naik.map((g) => `${g.nama} (${kg(g.terbaik_kg)} kg × ${g.terbaik_reps})`).join(", ")}.${pr.length ? ` PR: ${pr.map((g) => g.nama).join(", ")}.` : ""}`
        : `${i.total_set_kerja} set tercatat, belum ada gerakan yang naik dibanding sesi lalu.`,
    pertahankan: `Konsisten datang: ${i.total_set_kerja} set, volume ${i.total_volume_kg.toLocaleString("id-ID")} kg di ${i.program_hari}.`,
    perbaiki: [
      turun.length > 0
        ? `Cek ${turun.map((g) => g.nama).join(", ")}: hasilnya di bawah sesi lalu.`
        : "Pertahankan teknik yang rapi sebelum nambah beban.",
      ...(i.gerakan_dilewati.length > 0 ? [`Tadi dilewati: ${i.gerakan_dilewati.map((g) => g.nama).join(", ")}. Coba tuntasin di sesi berikutnya.`] : []),
    ],
    nutrisi:
      n.jumlah_makan_tercatat === 0
        ? "Belum ada catatan makan hari ini."
        : `${n.kcal.toLocaleString("id-ID")} dari ${n.target_kcal.toLocaleString("id-ID")} kcal, protein ${n.protein_g} dari ${n.target_protein_g} g.`,
    tidur: tidurCadangan(i),
    besok: i.besok.jenis === "latihan" ? `Besok ${i.besok.hari}: ${i.besok.nama_program ?? "latihan"}.` : `Besok ${i.besok.hari} istirahat. Berikutnya ${i.besok.nama_program ?? "latihan"}.`,
  };
}

type Hasil = { text: string; pakaiAi: boolean };

async function tanyaAi(input: SummaryInput, tambahan?: string): Promise<KesimpulanData | null> {
  const client = new Anthropic({ timeout: 25_000, maxRetries: 1 });
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 3000,
    system: SYSTEM,
    output_config: { effort: "low", format: zodOutputFormat(Kesimpulan) },
    messages: [
      {
        role: "user",
        content: `DATA (hasil hitungan kode):\n${JSON.stringify(input, null, 2)}${tambahan ? `\n\n${tambahan}` : ""}\n\nTulis kesimpulannya.`,
      },
    ],
  });
  await logUsage("kesimpulan_harian", MODEL, response.usage.input_tokens, response.usage.output_tokens);
  if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") return null;
  return response.parsed_output ?? null;
}

function semuaTeks(k: KesimpulanData): string {
  return [k.berubah, k.pertahankan, ...k.perbaiki, k.nutrisi, k.tidur, k.besok].join("\n");
}

/** Buat kesimpulan: AI -> periksa angka -> (sekali ulang) -> cadangan tanpa AI. */
export async function tulisKesimpulan(input: SummaryInput): Promise<Hasil> {
  const turunan = angkaTurunan(input);
  try {
    let k = await tanyaAi(input);
    if (k) {
      let asing = angkaTidakDikenal(semuaTeks(k), input, turunan);
      if (asing.length > 0) {
        console.warn("Kesimpulan AI memuat angka di luar data, coba ulang:", asing);
        k = await tanyaAi(input, `Tulisan sebelumnya memuat angka yang TIDAK ada di data: ${asing.join(", ")}. Tulis ulang tanpa angka itu; pakai hanya angka dari DATA.`);
        asing = k ? angkaTidakDikenal(semuaTeks(k), input, turunan) : [1];
        if (asing.length > 0) k = null;
      }
      if (k) return { text: formatKesimpulan(input.hari, k), pakaiAi: true };
    }
  } catch (err) {
    console.error("Kesimpulan AI gagal:", err instanceof Anthropic.APIError ? `${err.status} ${err.message}` : String(err));
  }
  return { text: formatKesimpulan(input.hari, kesimpulanCadangan(input)), pakaiAi: false };
}

/** Bangun data, tulis kesimpulan, simpan di daily_summaries (satu per tanggal). */
export async function buatKesimpulanSesi(sessionId: number): Promise<(Hasil & { tanggal: string }) | null> {
  const input = await buildSummaryInput(sessionId);
  if (!input) return null;
  const hasil = await tulisKesimpulan(input);
  must(
    await db()
      .from("daily_summaries")
      .upsert({ summary_date: input.tanggal, summary_text: hasil.text, raw_numbers: { ...input, ditulis_ai: hasil.pakaiAi } }, { onConflict: "summary_date" }),
  );
  return { ...hasil, tanggal: input.tanggal };
}

export async function ambilKesimpulan(tanggal: string): Promise<string | null> {
  const r = must(await db().from("daily_summaries").select("summary_text").eq("summary_date", tanggal).maybeSingle()) as { summary_text: string } | null;
  return r?.summary_text ?? null;
}
