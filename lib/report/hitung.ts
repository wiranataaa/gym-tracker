// Hitungan laporan mingguan. Murni kode, tanpa AI.

function toDay(date: string): number {
  return Math.round(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)) / 86_400_000);
}

/** Senin dari minggu yang memuat tanggal ini (minggu = Senin sampai Minggu). */
export function awalMinggu(date: string): string {
  const d = toDay(date);
  const dow = (((d + 3) % 7) + 7) % 7; // 1970-01-01 hari Kamis; 0 = Senin
  return new Date((d - dow) * 86_400_000).toISOString().slice(0, 10);
}

export function geser(date: string, n: number): string {
  return new Date((toDay(date) + n) * 86_400_000).toISOString().slice(0, 10);
}

/** Skor konsistensi % = sesi selesai / target sesi per minggu (maksimal 100). */
export function skorKonsistensi(sesiSelesai: number, targetPerMinggu: number): number {
  if (!(targetPerMinggu > 0)) return 0;
  return Math.min(100, Math.round((sesiSelesai / targetPerMinggu) * 100));
}

/** Jumlah sesi per minggu (kunci = tanggal Senin) dari daftar tanggal sesi selesai. */
export function sesiPerMinggu(tanggalSesi: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tanggalSesi) {
    const k = awalMinggu(t);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

/**
 * Streak minggu konsisten: berapa minggu berturut-turut (mundur dari minggu yang baru selesai)
 * jumlah sesinya >= target. `mingguIni` = Senin minggu yang dilaporkan.
 */
export function streakMinggu(perMinggu: Map<string, number>, mingguIni: string, target: number): number {
  let n = 0;
  let w = mingguIni;
  while ((perMinggu.get(w) ?? 0) >= target && n < 520) {
    n++;
    w = geser(w, -7);
  }
  return n;
}

export type Penyesuaian = {
  kcalBaru: number;
  berubah: boolean;
  alasan: string;
};

export const LANGKAH_KCAL = 150;
export const KCAL_MIN = 2000;
export const KCAL_MAKS = 3600;

/**
 * Aturan penyesuaian kalori mingguan (CLAUDE.md 6.4), memakai laju dari rata-rata bergerak 7 hari:
 *  - naik < 0,2 kg/minggu selama 2 minggu -> +150 kcal
 *  - naik > 0,5 kg/minggu                  -> -150 kcal
 *  - di antaranya                          -> tetap
 * Mode Ramadan: target dijaga (maintenance), nggak diubah otomatis.
 */
export function sesuaikanKalori(args: {
  kcalSekarang: number;
  lajuMingguIni: number | null;
  lajuMingguLalu: number | null;
  ramadan: boolean;
}): Penyesuaian {
  const { kcalSekarang, lajuMingguIni: now, lajuMingguLalu: prev, ramadan } = args;
  const tetap = (alasan: string): Penyesuaian => ({ kcalBaru: kcalSekarang, berubah: false, alasan });

  if (ramadan) return tetap("Mode Ramadan aktif: target dijaga, nggak diubah otomatis.");
  if (now == null) return tetap("Data timbangan belum cukup (butuh rata-rata 7 hari di dua minggu berturut-turut).");

  if (now > 0.5) {
    const baru = Math.max(KCAL_MIN, kcalSekarang - LANGKAH_KCAL);
    return baru === kcalSekarang
      ? tetap("Naik terlalu cepat, tapi target sudah di batas bawah aman.")
      : { kcalBaru: baru, berubah: true, alasan: `Berat naik ${String(now).replace(".", ",")} kg minggu ini (di atas 0,5). Target turun ${LANGKAH_KCAL} kcal supaya lebih banyak jadi otot, bukan lemak.` };
  }

  if (now < 0.2 && prev != null && prev < 0.2) {
    const baru = Math.min(KCAL_MAKS, kcalSekarang + LANGKAH_KCAL);
    return baru === kcalSekarang
      ? tetap("Naiknya lambat, tapi target sudah di batas atas aman.")
      : { kcalBaru: baru, berubah: true, alasan: `Berat naik di bawah 0,2 kg/minggu selama 2 minggu berturut-turut (${String(prev).replace(".", ",")} dan ${String(now).replace(".", ",")}). Target naik ${LANGKAH_KCAL} kcal.` };
  }

  if (now < 0.2) return tetap(`Naik ${String(now).replace(".", ",")} kg minggu ini, di bawah 0,2. Kalau minggu depan masih lambat, target naik ${LANGKAH_KCAL} kcal.`);
  return tetap(`Laju ${String(now).replace(".", ",")} kg/minggu masih di rentang 0,2-0,5. Target tetap.`);
}

/**
 * Gerakan stagnan: minimal 4 sesi, dan 3 sesi terakhir nggak ada yang melampaui
 * estimasi 1RM terbaik sebelum 3 sesi itu.
 */
export function stagnan(e1rmPerSesi: number[]): boolean {
  if (e1rmPerSesi.length < 4) return false;
  const terakhir = e1rmPerSesi.slice(-3);
  const sebelumnya = Math.max(...e1rmPerSesi.slice(0, -3));
  return Math.max(...terakhir) <= sebelumnya;
}
