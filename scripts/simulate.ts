// Simulasi end-to-end: handler bot + database ASLI, tapi pesan TIDAK dikirim ke Telegram.
// Semua data uji dihapus di akhir.
// Jalankan: node --env-file=.env.local scripts/simulate.ts

import { readFileSync } from "node:fs";
import { pesanPagi } from "../lib/bot/pagi.ts";
import { ambilKesimpulan, buatKesimpulanSesi, tulisKesimpulan } from "../lib/ai/summary.ts";
import { buildSummaryInput } from "../lib/workout/summaryData.ts";
import type { Keyboard } from "../lib/telegram.ts";
import { handleBotInput } from "../lib/bot/handlers.ts";
import { db } from "../lib/supabase.ts";
import { getTargets, insertMeasurement, listMeasurements, removeMeasurement } from "../lib/body/db.ts";
import { createDraft, dayTotals, deleteMeal, listMeals, recentDays, setFactor, setStatus, signedPhotoUrls, uploadPhoto } from "../lib/nutrition/db.ts";
import { dailyValues, outlook } from "../lib/body/trend.ts";
import { todayWIB } from "../lib/time.ts";
import { exercisesWithData, getProgress, getSessionDetail, listSessions, updateSet } from "../lib/workout/history.ts";

const started = new Date().toISOString();
const dates: string[] = [];
let failures = 0;

async function say(date: string, input: string | { callback: string } | { photo: string }): Promise<string> {
  if (!dates.includes(date)) dates.push(date);
  const out: string[] = [];
  const ctx = {
    today: date,
    send: async (text: string, kb?: Keyboard) => {
      out.push(text + (kb ? `\n   [tombol: ${kb.flat().map((b) => `${b.text}=${b.url ?? b.data}`).join(" | ")}]` : ""));
    },
    downloadPhoto: async () => {
      const file = process.env.SIM_IMAGE;
      if (!file) return null;
      return { bytes: new Uint8Array(readFileSync(file)), mime: "image/png" };
    },
  };
  const label = typeof input === "string" ? input : "callback" in input ? `(klik ${input.callback})` : `(kirim foto "${input.photo}")`;
  const update = typeof input === "string" ? { text: input } : "callback" in input ? { callbackData: input.callback } : { photoFileId: "sim", caption: input.photo };
  await handleBotInput(update, ctx);
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
  // Nutrisi: hapus foto di Storage, lalu makan (item ikut terhapus) dan favorit uji
  const { data: meals } = await client.from("meals").select("id,photo_path").gte("created_at", started);
  const fotos = (meals ?? []).map((m: { photo_path: string | null }) => m.photo_path).filter(Boolean) as string[];
  if (fotos.length) await client.storage.from("meal-photos").remove(fotos);
  if (meals?.length) await client.from("meals").delete().in("id", meals.map((m: { id: number }) => m.id));
  await client.from("favorite_foods").delete().gte("created_at", started);
  await client.from("daily_summaries").delete().in("summary_date", dates);
  console.log(`🧹 Nutrisi uji dihapus (${meals?.length ?? 0} makan, ${fotos.length} foto).`);

  const { data: sessions } = await client.from("workout_sessions").select("id").gte("started_at", started);
  const ids = (sessions ?? []).map((s: { id: number }) => s.id);
  if (ids.length) await client.from("workout_sessions").delete().in("id", ids);
  await client.from("daily_plans").delete().in("plan_date", dates);
  await client.from("body_measurements").delete().gte("created_at", started);
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
  expect("kesimpulan ikut dikirim setelah rekap", r.includes("Lagi nulis kesimpulan") && r.includes("Kesimpulan Selasa") && r.includes("Yang berubah"));
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
  expect("bench naik ke 62 kg (kelipatan 2)", r.includes("62 kg × 6"));
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

  // --- Halaman Riwayat dan Progres (query yang dipakai app) ---
  console.log("\n▶ Query Riwayat & Progres");
  const sesi = await listSessions();
  const uji = sesi.filter((s) => dates.includes(s.date));
  expect("riwayat: sesi uji muncul (>=4)", uji.length >= 4);
  expect("riwayat: ada volume & set", uji.every((s) => s.totalSets > 0 && s.volumeKg > 0));

  const detail = await getSessionDetail(uji[uji.length - 1].id);
  expect("detail sesi: ada gerakan & set", !!detail && detail.exercises.length > 0 && detail.exercises[0].sets.length > 0);

  const daftar = await exercisesWithData();
  const bench = daftar.find((e) => e.name === "Bench Press");
  expect("progres: Bench Press ada di daftar gerakan", !!bench);
  if (bench) {
    const p = await getProgress(bench.id);
    expect("progres: 2 titik (1 Des & 7 Des)", p.points.filter((x) => dates.includes(x.date)).length === 2);
    expect("progres: 1RM terbaik 82,3 (65x8)", p.bestE1rm?.value === 82.3);
    expect("progres: beban terberat 65 kg", p.heaviest?.weightKg === 65);

    const set = (await getSessionDetail(uji.find((s) => s.date === "2026-12-07")!.id))!.exercises
      .find((e) => e.name === "Bench Press")!.sets[0];
    await updateSet(set.id, 66, 8, 9);
    const after = (await getSessionDetail(uji.find((s) => s.date === "2026-12-07")!.id))!.exercises
      .find((e) => e.name === "Bench Press")!.sets[0];
    expect("edit set tersimpan (66 kg, RPE 9)", after.weightKg === 66 && after.rpe === 9);
  }

  // --- Halaman Badan ---
  console.log("\n▶ Query Badan");
  const target = await getTargets();
  expect("target: 75 kg dan tanggal Lebaran ada", target.targetKg === 75 && /^\d{4}-\d{2}-\d{2}$/.test(target.lebaranDate));

  await insertMeasurement(71.4, "pagi_puasa");
  const ukur = await listMeasurements();
  const baru = ukur[0];
  expect("timbangan baru tersimpan, kondisi standar", baru.weightKg === 71.4 && baru.condition === "pagi_puasa");
  expect("tanggal timbangan = hari ini WIB", baru.date === todayWIB());
  const baseline = ukur.find((m) => m.bodyFatPct != null);
  expect("baseline Tanita (body fat 19,5%) terbaca", baseline?.bodyFatPct === 19.5 && baseline?.muscleMassKg === 54.25);

  const harian = dailyValues(ukur.map((m) => ({ date: m.date, weightKg: m.weightKg })));
  const o = outlook({ daily: harian, today: todayWIB(), targetKg: target.targetKg, targetDate: target.lebaranDate });
  expect("outlook terhitung dari data asli", !!o && o.currentAvg > 60 && o.daysLeft > 0);
  await removeMeasurement(baru.id);
  expect("timbangan uji terhapus", !(await listMeasurements()).some((m) => m.id === baru.id));

  // --- Pesan pagi otomatis (cron), Selasa 8 Des: rekap kemarin (Senin 7 Des) + menu hari ini ---
  console.log("\n▶ Pesan pagi");
  const pagi: string[] = [];
  await pesanPagi({
    today: "2026-12-08",
    send: async (text, kb) => {
      pagi.push(text + (kb ? `\n   [tombol: ${kb.flat().map((b) => `${b.text}=${b.url ?? b.data}`).join(" | ")}]` : ""));
    },
  });
  console.log(pagi.join("\n---\n"));
  expect("pagi: ada sapaan dan tanggal", pagi[0].includes("Selamat pagi") && pagi[0].includes("Selasa"));
  expect("pagi: rekap latihan kemarin (Full Body A)", pagi[0].includes("Kemarin: Full Body A"));
  expect("pagi: rekap makan kemarin kosong -> ajakan kirim foto", pagi[0].includes("Belum ada catatan makan"));
  expect("pagi: ada tombol buka app", pagi[0].includes("Buka app") && pagi[0].includes("https://"));
  expect("pagi: pesan kedua = menu hari ini dengan target", pagi.length === 2 && pagi[1].includes("Full Body") && pagi[1].includes("target"));

  // --- Nutrisi (memanggil Claude beneran, biayanya sekitar sen) ---
  console.log("\n▶ Nutrisi");
  const hari = "2026-12-08";
  r = await say(hari, "/makan nasi putih 1 piring + ayam bakar paha + tempe goreng 2 potong");
  expect("makan teks: ada total kcal dan protein", /Total: [\d.]+ kcal/.test(r) && r.includes("Protein"));
  expect("makan teks: ada tombol simpan, porsi, favorit", r.includes("mk:s:") && r.includes("mk:p:") && r.includes("mk:f:"));
  expect("makan teks: draft belum masuk hitungan", r.includes("belum disimpan"));
  const mid = /mk:s:(\d+)/.exec(r)?.[1];
  const kcalAwal = Number(/Total: ([\d.]+) kcal/.exec(r)?.[1]?.replace(/\./g, ""));
  expect("kalori masuk akal buat makan itu (300-1500)", kcalAwal >= 300 && kcalAwal <= 1500);

  r = await say(hari, { callback: `mk:p:${mid}:2` });
  const kcal2x = Number(/Total: ([\d.]+) kcal/.exec(r)?.[1]?.replace(/\./g, ""));
  expect("porsi 2x menggandakan kalori (±2%)", Math.abs(kcal2x - kcalAwal * 2) <= kcalAwal * 0.04);
  r = await say(hari, { callback: `mk:p:${mid}:1` });
  expect("porsi balik ke 1x = kalori awal", Number(/Total: ([\d.]+) kcal/.exec(r)?.[1]?.replace(/\./g, "")) === kcalAwal);

  r = await say(hari, { callback: `mk:s:${mid}` });
  expect("simpan: muncul progres harian", r.includes("Hari ini:") && r.includes("Sisa:"));
  r = await say(hari, "/nutrisi");
  expect("/nutrisi menampilkan progres", r.includes("Protein"));

  r = await say(hari, { callback: `mk:f:${mid}` });
  expect("favorit tersimpan", r.includes("favorit"));
  r = await say(hari, "/fav");
  const favId = /mk:u:(\d+)/.exec(r)?.[1];
  expect("/fav menampilkan tombol favorit", !!favId);
  r = await say(hari, { callback: `mk:u:${favId}` });
  expect("favorit sekali tap langsung tersimpan", r.includes("✅") && r.includes("Hari ini:"));

  r = await say(hari, "/makan");
  expect("/makan tanpa teks memberi contoh", r.includes("Contoh"));
  r = await say(hari, { callback: `mk:d:${mid}` });
  expect("buang makanan", r.includes("Dihapus"));

  if (process.env.SIM_IMAGE) {
    r = await say(hari, { photo: "" });
    expect("foto bukan makanan ditolak sopan", r.includes("bukan makanan") || r.includes("Total:"));
  }
  // --- Halaman Nutrisi di app (query tanpa AI): draft vs tersimpan, porsi, foto bertanda tangan ---
  console.log("\n▶ Query halaman Nutrisi");
  const tgl = "2026-12-09";
  const fotoPath = process.env.SIM_IMAGE ? await uploadPhoto(new Uint8Array(readFileSync(process.env.SIM_IMAGE)), "image/png") : null;
  const draft = await createDraft({
    source: "foto",
    aiModel: "uji",
    date: tgl,
    photoPath: fotoPath,
    data: {
      ada_makanan: true,
      ringkasan: "Nasi uji",
      item: [{ nama: "Nasi putih", porsi_g: 200, kcal: 260, protein_g: 5, karbo_g: 57, lemak_g: 0.5, catatan: "" }],
      kcal_min: 230,
      kcal_max: 300,
      keyakinan: "sedang",
      pertanyaan: "",
    },
  });
  expect("draft: ada di daftar tapi belum masuk total harian", (await listMeals(tgl)).length === 1 && (await dayTotals(tgl)).kcal === 0);
  await setStatus(draft.id, "tersimpan");
  expect("disimpan: masuk total harian (260 kcal)", (await dayTotals(tgl)).kcal === 260);
  const x15 = await setFactor(draft.id, 1.5);
  expect("porsi 1,5x: 390 kcal, kisaran 345-450", x15?.kcal === 390 && x15?.kcalMin === 345 && x15?.kcalMax === 450);
  expect("total harian ikut porsi (390)", (await dayTotals(tgl)).kcal === 390);
  expect("7 hari terakhir memuat tanggal itu", (await recentDays(30, "2026-12-09")).some((x) => x.date === tgl && x.kcal === 390));
  if (fotoPath) {
    const urls = await signedPhotoUrls([fotoPath]);
    const res = await fetch(urls.get(fotoPath) ?? "http://invalid.invalid");
    expect("foto: tanda tangan URL bisa dibuka (image)", res.ok && (res.headers.get("content-type") ?? "").startsWith("image/"));
    const publik = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/meal-photos/${fotoPath}`);
    expect("foto: URL publik tanpa tanda tangan ditolak (bucket privat)", !publik.ok);
  }
  await deleteMeal(draft.id);
  expect("hapus makanan: hilang dari daftar", (await listMeals(tgl)).length === 0);

  // --- Kesimpulan AI: data dari kode, pemeriksa angka, dan cadangan kalau AI gagal ---
  console.log("\n▶ Kesimpulan AI");
  const acuan = uji.find((s) => s.date === "2026-12-07");
  const masuk = acuan ? await buildSummaryInput(acuan.id) : null;
  expect("data kesimpulan: gerakan, volume per otot, besok", !!masuk && masuk.gerakan.length > 0 && masuk.volume_per_otot_kg.length > 0 && !!masuk.besok.hari);
  const bench7 = masuk?.gerakan.find((g) => g.nama === "Bench Press");
  expect("data kesimpulan: bench naik beban dan PR terdeteksi (kode, bukan AI)", bench7?.perbandingan === "beban_naik" && bench7?.pr === true);

  if (masuk) {
    const kunciAsli = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = "sk-ant-kunci-salah";
    const cad = await tulisKesimpulan(masuk);
    process.env.ANTHROPIC_API_KEY = kunciAsli;
    expect("AI gagal (kunci salah) -> cadangan tanpa AI tetap jadi", !cad.pakaiAi && cad.text.includes("Yang berubah") && cad.text.includes("Besok"));

    const ai = await tulisKesimpulan(masuk);
    console.log(ai.text);
    expect("AI sukses dan lolos pemeriksaan angka (nggak ada angka karangan)", ai.pakaiAi);
    const simpan = await buatKesimpulanSesi(acuan!.id);
    expect("kesimpulan tersimpan di daily_summaries", !!simpan && (await ambilKesimpulan("2026-12-07")) === simpan.text);
  }

  const biaya = await db().from("ai_usage_log").select("feature,input_tokens,output_tokens,est_cost_usd").gte("created_at", started);
  const rows = (biaya.data ?? []) as { feature: string; input_tokens: number; output_tokens: number; est_cost_usd: number }[];
  const total = rows.reduce((a, x) => a + Number(x.est_cost_usd), 0);
  console.log(`  💲 ${rows.length} panggilan AI, perkiraan biaya $${total.toFixed(4)}`);
  expect("biaya AI tercatat di ai_usage_log", rows.length >= 1);
}

// PENGAMAN: simulasi memakai database yang SAMA dengan data asli dan menutup "sesi lama" berdasarkan
// tanggal palsu. Kalau sudah ada data latihan/makan asli, jangan jalan (kecuali dipaksa).
async function pastikanDatabaseKosong() {
  const client = db();
  const hitung = async (tabel: string) =>
    (await client.from(tabel).select("id", { count: "exact", head: true })).count ?? 0;
  const [sesi, makan] = await Promise.all([hitung("workout_sessions"), hitung("meals")]);
  if ((sesi > 0 || makan > 0) && process.env.FORCE_SIM !== "1") {
    console.error(
      `\n⛔ Simulasi dibatalkan: database sudah berisi data asli (${sesi} sesi latihan, ${makan} makan).\n` +
        "   Simulasi bisa menutup sesi yang lagi berjalan dan mengacaukan antrean. Pakai project Supabase terpisah\n" +
        "   buat tes, atau jalankan dengan FORCE_SIM=1 kalau yakin datanya cuma data uji.",
    );
    process.exit(2);
  }
}

pastikanDatabaseKosong()
  .then(main)
  .catch((e) => {
    failures++;
    console.error("\n💥 Error:", e);
  })
  .finally(async () => {
    await cleanup();
    console.log(failures === 0 ? "\n✅ SEMUA SKENARIO LOLOS" : `\n❌ ${failures} pemeriksaan gagal`);
    process.exit(failures === 0 ? 0 : 1);
  });
