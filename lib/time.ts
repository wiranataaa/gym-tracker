// Semua logika "hari ini" pakai Asia/Jakarta (WIB), bukan UTC.

const TZ = "Asia/Jakarta";

/** Tanggal hari ini di WIB, format "YYYY-MM-DD". */
export function todayWIB(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: TZ }).format(now);
}

/** Hari dalam seminggu untuk tanggal "YYYY-MM-DD": 1 = Senin ... 7 = Minggu. */
export function isoWeekday(date: string): number {
  const d = new Date(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10))).getUTCDay();
  return d === 0 ? 7 : d;
}

const HARI = ["", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
export function namaHari(date: string): string {
  return HARI[isoWeekday(date)];
}

const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

/** "2026-12-01" -> "Sel, 1 Des" */
export function tglPendek(date: string): string {
  return `${namaHari(date).slice(0, 3)}, ${parseInt(date.slice(8, 10), 10)} ${BULAN[parseInt(date.slice(5, 7), 10) - 1]}`;
}

/** "2026-12-01" -> "1 Des" */
export function tglSingkat(date: string): string {
  return `${parseInt(date.slice(8, 10), 10)} ${BULAN[parseInt(date.slice(5, 7), 10) - 1]}`;
}

/** "2027-03-10" -> "10 Mar 2027" */
export function tglLengkap(date: string): string {
  return `${tglSingkat(date)} ${date.slice(0, 4)}`;
}

/** Geser tanggal "YYYY-MM-DD" sebanyak n hari. */
export function addDays(date: string, n: number): string {
  const t = Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)) + n * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/** Tampilan berat ala Indonesia: 62,5 (koma desimal, tanpa nol berlebih). */
export function fmtKg(n: number): string {
  return String(Number(n.toFixed(2))).replace(".", ",");
}

export function fmtInt(n: number): string {
  return Math.round(n).toLocaleString("id-ID");
}
