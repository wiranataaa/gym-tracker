// Simulasi end-to-end: handler bot + database ASLI, tapi pesan TIDAK dikirim ke Telegram.
// Semua data uji dihapus di akhir.
// Jalankan: node --env-file=.env.local scripts/simulate.ts

import { handleBotInput } from "../lib/bot/handlers.ts";
import { db } from "../lib/supabase.ts";

const started = new Date().toISOString();
const dates: string[] = [];
let failures = 0;

async function say(date: string, input: string | { callback: string }): Promise<string> {
  if (!dates.includes(date)) dates.push(date);
  const out: string[] = [];
  const ctx = {
    today: date,
    send: async (text: string, kb?: { text: string; data: string }[][]) => {
      out.push(text + (kb ? `\n   [tombol: ${kb.flat().map((b) => `${b.text}=${b.data}`).join(" | ")}]` : ""));
    },
  };
  const label = typeof input === "string" ? input : `(klik ${input.callback})`;
  await handleBotInput(typeof input === "string" ? { text: input } : { callbackData: input.callback }, ctx);
  const joined = out.join("\n---\n");
  console.log(`\n▶ ${date} Nata: ${label}\n${joined}`);
  return joined;
}

function expect(name: string, cond: boolean) {
  if (!cond) failures++;
  console.log(`${cond ? "  ✔" : "  ✘ GAGAL"} ${name}`);
}

async function cleanup() {
  const client = db();
  const { data: sessions } = await client.from("workout_sessions").select("id").gte("started_at", started);
  const ids = (sessions ?? []).map((s: { id: number }) => s.id);
  if (ids.length) await client.from("workout_sessions").delete().in("id", ids);
  await client.from("daily_plans").delete().in("plan_date", dates);
  await client.from("body_measurements").delete().eq("source", "telegram").gte("created_at", started);
  console.log(`\n🧹 Data uji dihapus (${ids.length} sesi, ${dates.length} tanggal).`);
}

async function main() {
  // --- Selasa 1 Des: hari pertama ---
  let r = await say("2026-12-01", "/hari_ini");
  expect("menu pertama = Full Body A", r.includes("Full Body A"));
  expect("belum ada data -> pilih beban sendiri", r.includes("pilih beban sendiri"));

  r = await say("2026-12-01", "bench 60x10x3");
  expect("sesi otomatis dimulai", r.includes("dimulai otomatis"));
  expect("set pertama jadi patokan", r.includes("Pertama kali"));
  expect("progres 3/3", r.includes("3/3"));

  r = await say("2026-12-01", "squat 80 8 8 7 rpe8");
  expect("RPE kebaca", r.includes("RPE 8"));
  r = await say("2026-12-01", "row 40x10x3");
  r = await say("2026-12-01", "blabla");
  expect("format salah ditolak sopan", r.includes("Format nggak kebaca"));
  r = await say("2026-12-01", "deadlift 100x5");
  expect("gerakan nggak dikenal", r.includes("nggak ada di daftar"));

  r = await say("2026-12-01", "/selesai");
  expect("tanya energi", r.includes("berenergi"));
  const sessionId = /energi:(\d+):1/.exec(r)?.[1];
  r = await say("2026-12-01", { callback: `energi:${sessionId}:4` });
  expect("rekap latihan", r.includes("Latihan selesai") && r.includes("volume"));
  expect("antrean maju ke B", r.includes("Full Body B"));

  // --- Rabu 2 Des: skip, antrean nggak maju ---
  r = await say("2026-12-02", "/hari_ini");
  expect("Rabu menu = Full Body B", r.includes("Full Body B"));
  await say("2026-12-02", "/skip");
  r = await say("2026-12-02", "/hari_ini");
  expect("setelah skip, /hari_ini bilang udah di-skip", r.includes("skip"));

  // --- Kamis 3 Des: B, lupa /selesai ---
  r = await say("2026-12-03", "/hari_ini");
  expect("skip nggak majuin antrean: tetap B", r.includes("Full Body B"));
  await say("2026-12-03", "rdl 70x8x3");

  // --- Jumat 4 Des: sesi kemarin ditutup otomatis, antrean ke C, mode singkat ---
  await say("2026-12-04", "/singkat");
  r = await say("2026-12-04", "/hari_ini");
  expect("antrean maju ke C setelah sesi lupa-selesai ditutup", r.includes("Full Body C"));
  expect("mode singkat: maksimal 3 gerakan", !r.includes("4. "));
  await say("2026-12-04", "/mulai");
  await say("2026-12-04", "smith 60x8x3");
  r = await say("2026-12-04", { callback: "next" });
  expect("tombol gerakan berikutnya", r.includes("Berikutnya"));
  r = await say("2026-12-04", "/selesai");
  const sid2 = /energi:(\d+):1/.exec(r)?.[1];
  await say("2026-12-04", { callback: `energi:${sid2}:3` });

  // --- Senin 7 Des: A lagi, target dari riwayat (bench 60x10x3 = batas atas -> naik) ---
  r = await say("2026-12-07", "/hari_ini");
  expect("Senin kembali ke Full Body A", r.includes("Full Body A"));
  expect("bench naik ke 62,5 kg", r.includes("62,5 kg × 6"));
  r = await say("2026-12-07", "bench 65x8");
  expect("PR terdeteksi", r.includes("PR"));
  expect("dibandingkan sesi lalu", r.includes("Sesi lalu: 60 kg × 10"));

  // --- Sabtu 12 Des: hari istirahat ---
  r = await say("2026-12-12", "/hari_ini");
  expect("weekend = istirahat", r.includes("istirahat"));
  r = await say("2026-12-12", { callback: "menu" });
  expect("tombol 'tetap latihan' tetap kasih menu", r.includes("Full Body"));

  // --- Timbangan ---
  r = await say("2026-12-07", "/timbang 71,4 pagi");
  expect("timbang tercatat", r.includes("71,4"));

  // --- Libur 10 hari -> beban diturunin ---
  await say("2026-12-07", { callback: "selesai" });
  r = await say("2026-12-22", "/hari_ini");
  expect("balik libur: ada catatan libur", r.includes("nggak latihan"));

  expect("perintah tak dikenal", (await say("2026-12-22", "/ngawur")).includes("belum ada"));
}

main()
  .catch((e) => {
    failures++;
    console.error("\n💥 Error:", e);
  })
  .finally(async () => {
    await cleanup();
    console.log(failures === 0 ? "\n✅ SEMUA SKENARIO LOLOS" : `\n❌ ${failures} pemeriksaan gagal`);
    process.exit(failures === 0 ? 0 : 1);
  });
