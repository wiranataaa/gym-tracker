// Tren berat badan. Semua angka dihitung kode (bukan AI).
// Rata-rata bergerak 7 hari dipakai, bukan satu angka timbangan, karena berat naik-turun harian.

export type Weigh = { date: string; weightKg: number };

function toDay(date: string): number {
  return Math.round(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)) / 86_400_000);
}

export function daysBetween(from: string, to: string): number {
  return toDay(to) - toDay(from);
}

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Satu nilai per tanggal (rata-rata kalau timbang lebih dari sekali), urut dari lama ke baru. */
export function dailyValues(weighs: Weigh[]): Weigh[] {
  const m = new Map<string, number[]>();
  for (const w of weighs) m.set(w.date, [...(m.get(w.date) ?? []), w.weightKg]);
  return [...m.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, v]) => ({ date, weightKg: r2(v.reduce((a, x) => a + x, 0) / v.length) }));
}

/** Rata-rata nilai harian dalam jendela 7 hari yang berakhir di `end` (end-6 .. end). null kalau kosong. */
export function windowAverage(daily: Weigh[], end: string): number | null {
  const e = toDay(end);
  const inWin = daily.filter((d) => toDay(d.date) <= e && toDay(d.date) >= e - 6);
  if (inWin.length === 0) return null;
  return r2(inWin.reduce((a, d) => a + d.weightKg, 0) / inWin.length);
}

/** Rata-rata bergerak 7 hari di setiap tanggal yang punya timbangan. */
export function movingAverage7(daily: Weigh[]): Weigh[] {
  return daily.map((d) => ({ date: d.date, weightKg: windowAverage(daily, d.date) ?? d.weightKg }));
}

/**
 * Laju perubahan kg/minggu: rata-rata 7 hari terakhir dikurangi rata-rata 7 hari sebelumnya.
 * null kalau salah satu jendela kosong (data belum cukup).
 */
export function weeklyRate(daily: Weigh[], today: string): number | null {
  const now = windowAverage(daily, today);
  const before = windowAverage(daily, shift(today, -7));
  if (now == null || before == null) return null;
  return r2(now - before);
}

export function shift(date: string, n: number): string {
  return new Date((toDay(date) + n) * 86_400_000).toISOString().slice(0, 10);
}

export type Outlook = {
  currentAvg: number;
  daysLeft: number;
  weeksLeft: number;
  /** kg/minggu yang dibutuhkan supaya sampai target di tanggal target */
  neededPerWeek: number | null;
  /** perkiraan berat di tanggal target kalau laju sekarang bertahan */
  projectedKg: number | null;
};

export function outlook(args: {
  daily: Weigh[];
  today: string;
  targetKg: number;
  targetDate: string;
}): Outlook | null {
  const { daily, today, targetKg, targetDate } = args;
  const currentAvg = windowAverage(daily, today) ?? (daily.length ? daily[daily.length - 1].weightKg : null);
  if (currentAvg == null) return null;

  const daysLeft = daysBetween(today, targetDate);
  const weeksLeft = daysLeft / 7;
  const rate = weeklyRate(daily, today);

  return {
    currentAvg,
    daysLeft,
    weeksLeft: r2(weeksLeft),
    neededPerWeek: weeksLeft > 0 ? r2((targetKg - currentAvg) / weeksLeft) : null,
    projectedKg: rate != null && weeksLeft > 0 ? r2(currentAvg + rate * weeksLeft) : null,
  };
}
