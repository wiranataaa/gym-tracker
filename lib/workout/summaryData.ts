import { bandingkan, setTerbaik, type Banding } from "../program/compare.ts";
import { detectPR, estimate1RM } from "../program/pr.ts";
import { nextProgramDay } from "../program/queue.ts";
import { dayTotals } from "../nutrition/db.ts";
import { db, must } from "../supabase.ts";
import { addDays, isoWeekday, namaHari } from "../time.ts";
import { getHistory, getSettings, loadExercises, loadProgram, loadRecentSessions } from "./db.ts";
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
  nutrisi_hari_ini: {
    kcal: number;
    target_kcal: number;
    protein_g: number;
    target_protein_g: number;
    jumlah_makan_tercatat: number;
  };
  besok: { jenis: "latihan" | "istirahat"; nama_program: string | null; hari: string };
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
