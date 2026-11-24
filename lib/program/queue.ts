import { awalMinggu } from "../report/hitung.ts";

// Sistem antrean, bukan kalender: menu berikutnya = hari setelah sesi
// TERAKHIR YANG SELESAI di urutan program. Bolos/skip nggak majuin antrean.
//
// Ada dua jalur urutan:
//  - "utama": Full Body A -> B -> C (3 sesi per minggu).
//  - "bonus": D -> E -> F, dipakai kalau sesi utama minggu itu sudah penuh dan Nata masih mau
//    latihan lagi (jadi menunya bervariasi, nggak mengulang full body tiap hari).

export type JenisHari = "utama" | "bonus";

export type ProgramDay = { id: number; position: number; name: string; kind?: JenisHari };

export type SessionLite = {
  programDayId: number | null;
  status: "berjalan" | "selesai" | "dilewati";
  startedAt: string; // ISO timestamp
  /** tanggal sesi (WIB, "YYYY-MM-DD"); dipakai buat menghitung sesi minggu ini */
  date?: string;
};

export const kindOf = (d: ProgramDay): JenisHari => d.kind ?? "utama";

export function nextProgramDay(days: ProgramDay[], sessions: SessionLite[], kind: JenisHari = "utama"): ProgramDay | null {
  const ordered = days.filter((d) => kindOf(d) === kind).sort((a, b) => a.position - b.position);
  if (ordered.length === 0) return null;
  const ids = new Set(ordered.map((d) => d.id));

  const lastDone = sessions
    .filter((s) => s.status === "selesai" && s.programDayId != null && ids.has(s.programDayId))
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : a.startedAt > b.startedAt ? -1 : 0))[0];

  if (!lastDone) return ordered[0];

  const idx = ordered.findIndex((d) => d.id === lastDone.programDayId);
  if (idx < 0) return ordered[0];
  return ordered[(idx + 1) % ordered.length];
}

/** Berapa sesi hari utama yang sudah selesai di minggu (Senin-Minggu) yang memuat `hariIni`. */
export function sesiUtamaMingguIni(days: ProgramDay[], sessions: SessionLite[], hariIni: string): number {
  const mulai = awalMinggu(hariIni);
  const utama = new Set(days.filter((d) => kindOf(d) === "utama").map((d) => d.id));
  return sessions.filter(
    (s) => s.status === "selesai" && s.programDayId != null && utama.has(s.programDayId) && (s.date ?? s.startedAt.slice(0, 10)) >= mulai,
  ).length;
}

/**
 * Pilih menu hari ini. Sesi utama (A/B/C) dulu sampai penuh di minggu itu (default 3),
 * setelah itu menu bonus (D/E/F) supaya latihan tiap hari tetap bervariasi.
 * Kalau nggak ada hari bonus, tetap lanjut jalur utama.
 */
export function pilihHariIni(
  days: ProgramDay[],
  sessions: SessionLite[],
  hariIni: string,
  utamaPerMinggu = 3,
): { day: ProgramDay; jenis: JenisHari } | null {
  const utama = nextProgramDay(days, sessions, "utama");
  if (!utama) return null;
  if (sesiUtamaMingguIni(days, sessions, hariIni) >= utamaPerMinggu) {
    const bonus = nextProgramDay(days, sessions, "bonus");
    if (bonus) return { day: bonus, jenis: "bonus" };
  }
  return { day: utama, jenis: "utama" };
}
