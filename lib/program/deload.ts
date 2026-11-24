// Deteksi deload (minggu ringan), CLAUDE.md 6.3: tiap 6-8 minggu, atau kalau performa turun di banyak
// gerakan 2 sesi berturut-turut. Murni hitungan kode; saran + alasan dikirim ke Nata, dia yang memutuskan.

function toDay(date: string): number {
  return Math.round(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)) / 86_400_000);
}

export const MINGGU_SEBELUM_DELOAD = 7;
export const MIN_SESI_KONSISTEN = 12;
export const MIN_GERAKAN_TURUN = 3;
export const DELOAD_HARI = 7;
/** Volume saat deload: sekitar 60% dari biasanya. */
export const FAKTOR_VOLUME_DELOAD = 0.6;

export type RiwayatE1rm = { nama: string; e1rm: number[] }; // per sesi, lama -> baru

/** Dua penurunan berturut-turut di tiga sesi terakhir: sesi terakhir < sebelumnya < sebelumnya lagi. */
export function turunBerturut(e1rm: number[]): boolean {
  if (e1rm.length < 3) return false;
  const [a, b, c] = e1rm.slice(-3);
  return c < b && b < a;
}

export type SaranDeload = { perlu: boolean; alasan: string[] };

export function deteksiDeload(args: {
  today: string;
  /** tanggal mulai deload terakhir */
  deloadTerakhir: string | null;
  /** tanggal sesi selesai paling awal */
  sesiPertama: string | null;
  /** jumlah sesi selesai sejak acuan (deload terakhir atau sesi pertama) */
  sesiSejakAcuan: number;
  riwayat: RiwayatE1rm[];
  sedangDeload: boolean;
}): SaranDeload {
  if (args.sedangDeload) return { perlu: false, alasan: [] };
  const alasan: string[] = [];

  const acuan = [args.deloadTerakhir, args.sesiPertama].filter((x): x is string => !!x).sort().pop() ?? null;
  if (acuan) {
    const minggu = (toDay(args.today) - toDay(acuan)) / 7;
    if (minggu >= MINGGU_SEBELUM_DELOAD && args.sesiSejakAcuan >= MIN_SESI_KONSISTEN) {
      alasan.push(`Udah ±${Math.floor(minggu)} minggu latihan (${args.sesiSejakAcuan} sesi) sejak deload terakhir / mulai. Tubuh perlu minggu ringan buat pulih.`);
    }
  }

  const dipantau = args.riwayat.filter((r) => r.e1rm.length >= 3);
  const turun = dipantau.filter((r) => turunBerturut(r.e1rm));
  if (turun.length >= MIN_GERAKAN_TURUN && turun.length / Math.max(1, dipantau.length) >= 0.4) {
    alasan.push(`Performa turun 2 sesi berturut-turut di ${turun.length} gerakan (${turun.map((t) => t.nama).join(", ")}). Itu tanda kelelahan numpuk.`);
  }

  return { perlu: alasan.length > 0, alasan };
}

/** Jumlah set saat deload: ±60% dari biasanya, minimal 2 (atau semula kalau memang cuma 1-2). */
export function setDeload(sets: number): number {
  if (sets <= 2) return sets;
  return Math.max(2, Math.round(sets * FAKTOR_VOLUME_DELOAD));
}

export const PANDUAN_DELOAD =
  "Minggu deload: set dikurangi ±40%, beban sama (atau turun ~10% kalau lagi capek banget), dan berhenti 3-4 rep sebelum gagal. Kardio ringan aja. Tujuannya pulih, bukan ngejar angka.";
