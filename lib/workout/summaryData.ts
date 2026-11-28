import { bandingkan, setTerbaik, type Banding } from "../program/compare.ts";
import { detectPR, estimate1RM } from "../program/pr.ts";
import { nextProgramDay } from "../program/queue.ts";
import { dayTotals } from "../nutrition/db.ts";
import { db, must } from "../supabase.ts";
import { listTidur, tidurHari } from "../tidur/db.ts";
import { fmtDurasi, jamDesimal, jamWIB, nilaiTidur, rataMenit, ringkasHari, TARGET_TIDUR_JAM, totalPerHari } from "../tidur/hitung.ts";
import { addDays, isoWeekday, namaHari } from "../time.ts";
import { getHistory, getSettings, getSkipped, getSwaps, loadExercises, loadProgram, loadRecentSessions } from "./db.ts";
import { getSessionDetail } from "./history.ts";

// Semua angka untuk kesimpulan dihitung di sini (kode). AI cuma menerima hasilnya.

export type GerakanSummary = {
  nama: string;
  set_kerja: number;
  terbaik_kg: number;
  terbaik_reps: number;
  sesi_lalu_kg: number | null;
  sesi_lalu_reps: number | null;
  perbandingan: Banding;
  pr: boolean;
};

export type SummaryInput = {
  tanggal: string;
  hari: string;
  program_hari: string;
  mode: "normal" | "singkat";
  energi_1_sampai_5: number | null;
  total_set_kerja: number;
  total_volume_kg: number;
  gerakan: GerakanSummary[];
  volume_per_otot_kg: { otot: string; kg: number; sesi_sebelumnya_kg: number | null }[];
  /** gerakan yang sisa setnya sengaja dilewati di sesi ini (alasannya nggak dicatat) */
  gerakan_dilewati: { nama: string; set_dikerjakan: number }[];
  /** gerakan yang diganti di sesi ini (biasanya karena alatnya penuh) */
  gerakan_diganti: { dari: string; ke: string }[];
  nutrisi_hari_ini: {
    kcal: number;
    target_kcal: number;
    protein_g: number;
    target_protein_g: number;
    jumlah_makan_tercatat: number;
  };
  besok: { jenis: "latihan" | "istirahat"; nama_program: string | null; hari: string };
  /** Jam di gym (WIB, "HH:MM"). selesai null kalau sesi belum ditutup. */
  jam_gym: { mulai: string; selesai: string | null; durasi_menit: number | null };
  /** Tidur semalam (bangun di tanggal sesi). null kalau belum dicatat. */
  tidur: TidurSummary | null;
};

export type TidurSummary = {
  jam_tidur: string;
  jam_bangun: string;
  durasi_jam: number;
  durasi_teks: string;
  target_jam: number;
  status: "cukup" | "agak_kurang" | "kurang";
  kualitas_1_sampai_5: number | null;
  catatan_nata: string | null;
  /** jam dari bangun sampai mulai gym; null kalau tidak masuk akal (mis. latihan sebelum bangun) */
  jam_bangun_ke_gym: number | null;
  rata2_tidur_7_hari_jam: number | null;
  malam_tercatat_7_hari: number;
  /** tidur tambahan di hari yang sama (jam_tidur/jam_bangun di atas = tidur terlama; durasi = TOTAL) */
  tidur_lain?: { jam_tidur: string; jam_bangun: string; durasi_teks: string }[];
};

const r0 = (n: number) => Math.round(n);

/** Volume (kg x reps) per kelompok otot dari daftar set kerja. */
function volumePerOtot(sets: { exerciseId: number; weightKg: number; reps: number }[], grup: Map<number, string>): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of sets) {
    const g = grup.get(s.exerciseId) ?? "Lainnya";
    m.set(g, (m.get(g) ?? 0) + s.weightKg * s.reps);
  }
  return m;
}

export async function buildSummaryInput(sessionId: number): Promise<SummaryInput | null> {
  const detail = await getSessionDetail(sessionId);
  if (!detail) return null;

  const [exercises, settings, totals, { days }, sessions] = await Promise.all([
    loadExercises(),
    getSettings(),
    dayTotals(detail.date),
    loadProgram(),
    loadRecentSessions(),
  ]);
  const grup = new Map(exercises.map((e) => [e.id, e.muscle_group]));

  const kerja = detail.exercises.map((e) => ({ ...e, sets: e.sets.filter((s) => !s.isWarmup) })).filter((e) => e.sets.length > 0);
  const history = await getHistory(kerja.map((e) => e.exerciseId), detail.date);

  const gerakan: GerakanSummary[] = kerja.map((e) => {
    const cur = setTerbaik(e.sets.map((s) => ({ weightKg: s.weightKg, reps: s.reps })));
    const pastSessions = history.get(e.exerciseId) ?? [];
    const last = pastSessions[0];
    const prev = last ? setTerbaik(last.sets) : null;
    const previousSets = pastSessions.flatMap((s) => s.sets);
    const pr = detectPR(cur, previousSets);
    return {
      nama: e.name,
      set_kerja: e.sets.length,
      terbaik_kg: cur.weightKg,
      terbaik_reps: cur.reps,
      sesi_lalu_kg: prev?.weightKg ?? null,
      sesi_lalu_reps: prev?.reps ?? null,
      perbandingan: bandingkan(prev, cur),
      pr: pr.e1rm || pr.reps,
    };
  });

  // Volume per otot hari ini vs sesi terakhir untuk hari program yang sama
  const todaySets = kerja.flatMap((e) => e.sets.map((s) => ({ exerciseId: e.exerciseId, weightKg: s.weightKg, reps: s.reps })));
  const volNow = volumePerOtot(todaySets, grup);

  let volPrev = new Map<string, number>();
  if (detail.programDayId) {
    const prevSession = must(
      await db()
        .from("workout_sessions")
        .select("id")
        .eq("program_day_id", detail.programDayId)
        .eq("status", "selesai")
        .lt("session_date", detail.date)
        .order("session_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ) as { id: number } | null;
    if (prevSession) {
      const rows = must(
        await db().from("workout_sets").select("exercise_id,weight_kg,reps").eq("session_id", prevSession.id).eq("is_warmup", false),
      ) as { exercise_id: number; weight_kg: number; reps: number }[];
      volPrev = volumePerOtot(
        rows.map((r) => ({ exerciseId: r.exercise_id, weightKg: Number(r.weight_kg), reps: r.reps })),
        grup,
      );
    }
  }

  // Jam gym + tidur semalam (pembacaan aman: kalau tabel tidur belum ada hasilnya kosong)
  const sesiWaktu = must(await db().from("workout_sessions").select("started_at,ended_at").eq("id", sessionId).maybeSingle()) as { started_at: string; ended_at: string | null } | null;
  const [sehari, tidur7] = await Promise.all([tidurHari(detail.date), listTidur(detail.date, 7)]);
  const mulaiGym = sesiWaktu?.started_at ?? null;
  const selesaiGym = sesiWaktu?.ended_at ?? null;
  const durasiGym = mulaiGym && selesaiGym ? Math.round((new Date(selesaiGym).getTime() - new Date(mulaiGym).getTime()) / 60_000) : null;
  let tidurData: TidurSummary | null = null;
  // Tidur yang selesai sebelum gym (kalau jam gym nggak cocok dengan satu pun, pakai semua tidur hari itu)
  const sebelumGym = sehari.filter((t) => !mulaiGym || Date.parse(t.wokeAt) <= Date.parse(mulaiGym));
  const ringkas = ringkasHari(sebelumGym.length ? sebelumGym : sehari);
  if (ringkas) {
    const { utama, lain, totalMenit } = ringkas;
    const n = nilaiTidur(totalMenit);
    const harian = [...totalPerHari(tidur7).values()];
    const rata = rataMenit(harian);
    const bangunTerakhir = Math.max(...[utama, ...lain].map((t) => Date.parse(t.wokeAt)));
    const bangunKeGym = mulaiGym ? (Date.parse(mulaiGym) - bangunTerakhir) / 3_600_000 : null;
    tidurData = {
      jam_tidur: utama.jamTidur,
      jam_bangun: utama.jamBangun,
      durasi_jam: jamDesimal(totalMenit),
      durasi_teks: fmtDurasi(totalMenit),
      target_jam: TARGET_TIDUR_JAM,
      status: n.level === "pas" ? "agak_kurang" : n.level,
      kualitas_1_sampai_5: utama.kualitas,
      catatan_nata: [utama, ...lain].map((t) => t.catatan).filter(Boolean).join(" / ") || null,
      jam_bangun_ke_gym: bangunKeGym != null && bangunKeGym >= 0 && bangunKeGym <= 24 ? Math.round(bangunKeGym * 10) / 10 : null,
      rata2_tidur_7_hari_jam: rata != null ? jamDesimal(rata) : null,
      malam_tercatat_7_hari: harian.length,
      ...(lain.length ? { tidur_lain: lain.map((t) => ({ jam_tidur: t.jamTidur, jam_bangun: t.jamBangun, durasi_teks: fmtDurasi(t.durasiMenit) })) } : {}),
    };
  }

  const dilewati = (await getSkipped(sessionId)).map((id) => ({
    nama: exercises.find((e) => e.id === id)?.name ?? "Gerakan",
    set_dikerjakan: kerja.find((e) => e.exerciseId === id)?.sets.length ?? 0,
  }));

  const namaGerakan = (id: number) => exercises.find((e) => e.id === id)?.name ?? "Gerakan";
  const diganti = (await getSwaps(sessionId)).map((g) => ({ dari: namaGerakan(g.dari), ke: namaGerakan(g.ke) }));

  const besokTanggal = addDays(detail.date, 1);
  const berikutnya = nextProgramDay(days, sessions);
  const besokLatihan = settings.workout_days.includes(isoWeekday(besokTanggal));

  return {
    tanggal: detail.date,
    hari: namaHari(detail.date),
    program_hari: detail.dayName,
    mode: detail.mode,
    energi_1_sampai_5: detail.energy,
    total_set_kerja: todaySets.length,
    total_volume_kg: r0(todaySets.reduce((a, s) => a + s.weightKg * s.reps, 0)),
    gerakan,
    gerakan_dilewati: dilewati,
    gerakan_diganti: diganti,
    volume_per_otot_kg: [...volNow.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([otot, kg]) => ({ otot, kg: r0(kg), sesi_sebelumnya_kg: volPrev.has(otot) ? r0(volPrev.get(otot)!) : null })),
    nutrisi_hari_ini: {
      kcal: r0(totals.kcal),
      target_kcal: settings.target_kcal,
      protein_g: r0(totals.proteinG),
      target_protein_g: settings.target_protein_g,
      jumlah_makan_tercatat: totals.count,
    },
    besok: {
      jenis: besokLatihan ? "latihan" : "istirahat",
      // program berikutnya di antrean (kalau besok istirahat, ini yang dikerjakan setelah istirahat)
      nama_program: berikutnya?.name ?? null,
      hari: namaHari(besokTanggal),
    },
    jam_gym: { mulai: mulaiGym ? jamWIB(mulaiGym) : "-", selesai: selesaiGym ? jamWIB(selesaiGym) : null, durasi_menit: durasiGym },
    tidur: tidurData,
  };
}

/** Angka turunan sederhana yang boleh muncul di teks AI (selisih beban, persen). */
export function angkaTurunan(input: SummaryInput): number[] {
  const out: number[] = [];
  for (const g of input.gerakan) {
    if (g.sesi_lalu_kg != null) out.push(Math.abs(g.terbaik_kg - g.sesi_lalu_kg));
    if (g.sesi_lalu_reps != null) out.push(Math.abs(g.terbaik_reps - g.sesi_lalu_reps));
    out.push(estimate1RM(g.terbaik_kg, g.terbaik_reps));
  }
  for (const v of input.volume_per_otot_kg) if (v.sesi_sebelumnya_kg != null) out.push(Math.abs(v.kg - v.sesi_sebelumnya_kg));
  const n = input.nutrisi_hari_ini;
  out.push(Math.max(0, n.target_kcal - n.kcal), Math.max(0, n.target_protein_g - n.protein_g));
  out.push(Math.round((n.kcal / n.target_kcal) * 100), Math.round((n.protein_g / n.target_protein_g) * 100));
  return out;
}
