import { bacaWaktuGym } from "../program/waktu.ts";
import { db, must } from "../supabase.ts";
import { getOpenSession, getSettings, getTodayPlan } from "../workout/db.ts";
import { colekanMalam, colekanPagi, ringkasMinggu, type Colekan, type Minggu } from "./hitung.ts";

export type Konsistensi = {
  minggu: Minggu;
  pagi: Colekan;
  /** teks colekan sore/malam, null kalau nggak perlu */
  malam: string | null;
};

/** Tanggal semua sesi selesai, terbaru dulu (cukup ±6 bulan ke belakang). */
async function tanggalSesiSelesai(limit = 150): Promise<string[]> {
  const rows = must(
    await db().from("workout_sessions").select("session_date").eq("status", "selesai").order("session_date", { ascending: false }).limit(limit),
  ) as { session_date: string }[];
  return rows.map((r) => r.session_date);
}

/**
 * Semua yang dibutuhkan fitur anti-bolos untuk hari ini: titik minggu ini, colekan pagi, colekan malam.
 * Hari ini diabaikan (nggak dicolek) kalau sesi lagi berjalan atau sengaja di-skip lewat tombol "Hari ini skip".
 */
export async function ambilKonsistensi(today: string): Promise<Konsistensi> {
  const [tanggalSelesai, settings, plan, terbuka] = await Promise.all([tanggalSesiSelesai(), getSettings(today), getTodayPlan(today), getOpenSession(today)]);
  const abaikanHariIni = plan?.status === "dilewati" || !!terbuka;
  const hariLatihan = settings.workout_days;

  const minggu = ringkasMinggu({ today, tanggalSelesai, hariLatihan, target: settings.sessions_per_week });
  return {
    minggu,
    pagi: colekanPagi({ today, tanggalSelesai, hariLatihan, abaikanHariIni }),
    malam: colekanMalam({ today, minggu, hariLatihan, abaikanHariIni, waktuGym: bacaWaktuGym(plan?.plan) }),
  };
}
