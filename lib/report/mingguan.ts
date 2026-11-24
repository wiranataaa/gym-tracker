import { dailyValues, outlook, weeklyRate, windowAverage } from "../body/trend.ts";
import { listMeasurements, getTargets } from "../body/db.ts";
import { PANDUAN_DELOAD } from "../program/deload.ts";
import { estimate1RM } from "../program/pr.ts";
import { cekDeload, type StatusDeload } from "./deloadCek.ts";
import { recentDays } from "../nutrition/db.ts";
import { db, must } from "../supabase.ts";
import { fmtInt, fmtKg, tglLengkap, tglSingkat } from "../time.ts";
import { getHistory, getSettings } from "../workout/db.ts";
import { exercisesWithData, getProgress, listSessions } from "../workout/history.ts";
import { awalMinggu, geser, sesiPerMinggu, sesuaikanKalori, skorKonsistensi, stagnan, streakMinggu, type Penyesuaian } from "./hitung.ts";

// Laporan mingguan (Minggu malam). Semua angka dihitung kode.

export type Laporan = {
  mingguMulai: string;
  mingguSelesai: string;
  sesi: { selesai: number; target: number; skor: number; streak: number; singkat: number };
  berat: {
    rataSekarang: number | null;
    rataMingguLalu: number | null;
    laju: number | null;
    lajuLalu: number | null;
    targetKg: number;
    targetTanggal: string;
    hariLagi: number | null;
    butuhPerMinggu: number | null;
    proyeksiKg: number | null;
  };
  pr: { nama: string; e1rm: number; kg: number; reps: number }[];
  stagnan: string[];
  nutrisi: { hariTercatat: number; rataKcal: number | null; rataProtein: number | null; hariProteinTercapai: number; targetKcal: number; targetProtein: number };
  kalori: Penyesuaian & { sebelum: number };
  deload: StatusDeload;
};

const koma = (n: number) => String(n).replace(".", ",");
const tanda = (n: number) => `${n >= 0 ? "+" : ""}${koma(n)}`;

export async function hitungLaporan(hariMinggu: string): Promise<Laporan> {
  const mulai = awalMinggu(hariMinggu);
  const [settings, targets, sesiList, ukur] = await Promise.all([getSettings(), getTargets(), listSessions(300), listMeasurements()]);

  // --- Latihan ---
  const selesai = sesiList.filter((s) => s.status === "selesai" && s.totalSets > 0);
  const perMinggu = sesiPerMinggu(selesai.map((s) => s.date));
  const jumlah = perMinggu.get(mulai) ?? 0;
  const sesiMingguIni = selesai.filter((s) => s.date >= mulai && s.date <= hariMinggu);
  const target = settings.sessions_per_week;

  // --- Berat ---
  const harian = dailyValues(ukur.map((m) => ({ date: m.date, weightKg: m.weightKg })));
  const rataSekarang = windowAverage(harian, hariMinggu);
  const rataLalu = windowAverage(harian, geser(hariMinggu, -7));
  const laju = weeklyRate(harian, hariMinggu);
  const lajuLalu = (() => {
    const a = windowAverage(harian, geser(hariMinggu, -7));
    const b = windowAverage(harian, geser(hariMinggu, -14));
    return a != null && b != null ? Math.round((a - b) * 100) / 100 : null;
  })();
  const o = outlook({ daily: harian, today: hariMinggu, targetKg: targets.targetKg, targetDate: targets.lebaranDate });

  // --- PR minggu ini ---
  const setMinggu = must(
    await db()
      .from("workout_sets")
      .select("exercise_id,weight_kg,reps,exercises(name),workout_sessions!inner(session_date,status)")
      .eq("is_warmup", false)
      .in("workout_sessions.status", ["selesai", "berjalan"])
      .gte("workout_sessions.session_date", mulai)
      .lte("workout_sessions.session_date", hariMinggu),
  ) as unknown as { exercise_id: number; weight_kg: number; reps: number; exercises: { name: string } }[];

  const idMinggu = [...new Set(setMinggu.map((s) => s.exercise_id))];
  const riwayat = await getHistory(idMinggu, mulai);
  const pr: Laporan["pr"] = [];
  for (const id of idMinggu) {
    const sebelum = (riwayat.get(id) ?? []).flatMap((s) => s.sets);
    if (sebelum.length === 0) continue; // pertama kali dicatat bukan PR
    const terbaikSebelum = Math.max(...sebelum.map((s) => estimate1RM(s.weightKg, s.reps)));
    const baris = setMinggu.filter((s) => s.exercise_id === id);
    const top = baris.reduce((a, s) => (estimate1RM(s.weight_kg, s.reps) > estimate1RM(a.weight_kg, a.reps) ? s : a));
    const e = estimate1RM(top.weight_kg, top.reps);
    if (e > terbaikSebelum) pr.push({ nama: top.exercises.name, e1rm: e, kg: top.weight_kg, reps: top.reps });
  }

  // --- Stagnan ---
  const stag: string[] = [];
  for (const ex of (await exercisesWithData()).slice(0, 12)) {
    const p = await getProgress(ex.id);
    if (stagnan(p.points.map((x) => x.e1rm))) stag.push(ex.name);
  }

  // --- Nutrisi 7 hari ---
  const hari = await recentDays(7, hariMinggu);
  const nutrisi: Laporan["nutrisi"] = {
    hariTercatat: hari.length,
    rataKcal: hari.length ? Math.round(hari.reduce((a, h) => a + h.kcal, 0) / hari.length) : null,
    rataProtein: hari.length ? Math.round(hari.reduce((a, h) => a + h.proteinG, 0) / hari.length) : null,
    hariProteinTercapai: hari.filter((h) => h.proteinG >= settings.target_protein_g).length,
    targetKcal: settings.target_kcal,
    targetProtein: settings.target_protein_g,
  };

  // Yang disesuaikan adalah target biasa (lean bulk). Saat Ramadan targetnya dijaga, nggak diubah otomatis.
  const kalori = {
    sebelum: settings.target_kcal_normal,
    ...sesuaikanKalori({ kcalSekarang: settings.target_kcal_normal, lajuMingguIni: laju, lajuMingguLalu: lajuLalu, ramadan: settings.ramadan_aktif }),
  };

  return {
    mingguMulai: mulai,
    mingguSelesai: hariMinggu,
    sesi: {
      selesai: jumlah,
      target,
      skor: skorKonsistensi(jumlah, target),
      streak: streakMinggu(perMinggu, mulai, target),
      singkat: sesiMingguIni.filter((s) => s.mode === "singkat").length,
    },
    berat: {
      rataSekarang,
      rataMingguLalu: rataLalu,
      laju,
      lajuLalu,
      targetKg: targets.targetKg,
      targetTanggal: targets.lebaranDate,
      hariLagi: o?.daysLeft ?? null,
      butuhPerMinggu: o?.neededPerWeek ?? null,
      proyeksiKg: o?.projectedKg ?? null,
    },
    pr,
    stagnan: stag,
    nutrisi,
    kalori,
    deload: await cekDeload(hariMinggu),
  };
}

export function formatLaporan(l: Laporan): string {
  const x: string[] = [];
  x.push(`📊 Laporan mingguan (${tglSingkat(l.mingguMulai)} – ${tglSingkat(l.mingguSelesai)})`, "");

  // Latihan
  x.push("🏋️ Latihan");
  const flame = l.sesi.skor >= 100 ? " 🔥" : "";
  x.push(`• ${l.sesi.selesai} dari ${l.sesi.target} sesi → konsistensi ${l.sesi.skor}%${flame}`);
  if (l.sesi.streak > 0) x.push(`• Streak: ${l.sesi.streak} minggu berturut-turut sesuai target`);
  else if (l.sesi.selesai === 0) x.push("• Minggu ini belum ada latihan. Nggak apa-apa, program tetap lanjut dari urutan terakhir.");
  if (l.sesi.singkat > 0) x.push(`• ${l.sesi.singkat} sesi pakai versi singkat (tetap kehitung)`);
  x.push("");

  // Berat
  x.push("⚖️ Berat badan");
  const b = l.berat;
  if (b.rataSekarang == null) {
    x.push("• Belum ada timbangan di 7 hari terakhir. Timbang pagi hari biar tren-nya kelihatan.");
  } else {
    const dibanding = b.rataMingguLalu != null ? ` (minggu lalu ${fmtKg(b.rataMingguLalu)} → ${tanda(Math.round((b.rataSekarang - b.rataMingguLalu) * 100) / 100)} kg)` : "";
    x.push(`• Rata-rata 7 hari: ${fmtKg(b.rataSekarang)} kg${dibanding}`);
    if (b.hariLagi != null && b.hariLagi > 0) {
      x.push(`• Target ${fmtKg(b.targetKg)} kg sebelum ${tglLengkap(b.targetTanggal)}: ${b.hariLagi} hari lagi${b.butuhPerMinggu != null ? `, butuh ±${fmtKg(b.butuhPerMinggu)} kg/minggu` : ""}`);
      if (b.proyeksiKg != null) x.push(`• Kalau laju sekarang bertahan, perkiraan ${fmtKg(b.proyeksiKg)} kg di tanggal itu`);
    }
  }
  x.push("");

  // PR dan stagnan
  x.push("🏆 PR minggu ini");
  if (l.pr.length === 0) x.push("• Belum ada PR minggu ini.");
  for (const p of l.pr) x.push(`• ${p.nama}: estimasi 1RM ${fmtKg(p.e1rm)} kg (${fmtKg(p.kg)} × ${p.reps})`);
  if (l.stagnan.length > 0) {
    x.push("");
    x.push("😴 Gerakan stagnan (3 sesi terakhir nggak ada rekor baru)");
    for (const s of l.stagnan) x.push(`• ${s}`);
    x.push("Saran: pastikan istirahat dan makan cukup, atau coba variasi rep/tempo sebelum nambah beban.");
  }
  x.push("");

  // Nutrisi
  x.push("🍽️ Nutrisi");
  const n = l.nutrisi;
  if (n.hariTercatat === 0 || n.rataKcal == null) {
    x.push("• Belum ada catatan makan minggu ini. Kirim foto makanan ke bot biar kalori dan protein kehitung.");
  } else {
    x.push(`• ${n.hariTercatat} hari tercatat · rata-rata ${fmtInt(n.rataKcal)} kcal (target ${fmtInt(n.targetKcal)}) · protein ${n.rataProtein} g (target ${n.targetProtein})`);
    x.push(`• Target protein tercapai ${n.hariProteinTercapai} dari ${n.hariTercatat} hari`);
  }
  x.push("");

  // Kalori minggu depan
  x.push("🔧 Target kalori minggu depan");
  x.push(l.kalori.berubah ? `• ${fmtInt(l.kalori.sebelum)} → ${fmtInt(l.kalori.kcalBaru)} kcal. ${l.kalori.alasan}` : `• Tetap ${fmtInt(l.kalori.kcalBaru)} kcal. ${l.kalori.alasan}`);

  if (l.deload.aktif) {
    x.push("", `🔋 Minggu deload lagi berjalan${l.deload.sampai ? ` sampai ${tglSingkat(l.deload.sampai)}` : ""}. Nikmatin pemulihannya.`);
  } else if (l.deload.perlu) {
    x.push("", "🔋 Saran deload (minggu ringan)", ...l.deload.alasan.map((a) => `• ${a}`), `${PANDUAN_DELOAD}`, "Mulai kapan pun lewat /deload mulai (atau di app → Pengaturan).");
  }
  return x.join("\n");
}

/** Sudah pernah dibuat untuk minggu ini? (kalau tabelnya belum ada, anggap belum) */
export async function laporanSudahAda(hariMinggu: string): Promise<boolean> {
  const { data, error } = await db().from("weekly_reports").select("id").eq("week_end", hariMinggu).maybeSingle();
  if (error) return false;
  return !!data;
}

/** Simpan laporan dan terapkan perubahan target kalori. Mengembalikan false kalau tabel belum siap. */
export async function simpanDanTerapkan(l: Laporan, teks: string): Promise<boolean> {
  const { error } = await db()
    .from("weekly_reports")
    .insert({ week_end: l.mingguSelesai, report_text: teks, data: l, kcal_before: l.kalori.sebelum, kcal_after: l.kalori.kcalBaru });
  if (error) {
    console.error("Gagal simpan laporan mingguan (sudah jalanin 005_laporan.sql?):", error.message);
    return false;
  }
  if (l.kalori.berubah) {
    must(await db().from("settings").update({ target_kcal: l.kalori.kcalBaru, updated_at: new Date().toISOString() }).eq("id", 1));
  }
  return true;
}

export async function laporanTerakhir(): Promise<{ week_end: string; report_text: string } | null> {
  const { data, error } = await db().from("weekly_reports").select("week_end,report_text").order("week_end", { ascending: false }).limit(1).maybeSingle();
  if (error) return null; // tabel belum ada
  return data as { week_end: string; report_text: string } | null;
}
