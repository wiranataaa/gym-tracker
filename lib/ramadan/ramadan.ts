// Mode Ramadan (CLAUDE.md 6.8). Murni hitungan kode; tanggal bisa diubah di Pengaturan
// karena tanggal resmi ditetapkan pemerintah.

export type OverrideRamadan = "auto" | "on" | "off";

export type PengaturanRamadan = {
  override: OverrideRamadan;
  /** hari pertama puasa "YYYY-MM-DD" */
  mulai: string;
  /** tanggal Idul Fitri (1 Syawal) "YYYY-MM-DD": hari pertama setelah Ramadan */
  lebaran: string;
};

/** Aktif kalau dipaksa 'on', atau 'auto' dan hari ini ada di rentang [mulai, lebaran). */
export function ramadanAktif(today: string, p: PengaturanRamadan): boolean {
  if (p.override === "on") return true;
  if (p.override === "off") return false;
  return today >= p.mulai && today < p.lebaran;
}

/** Sisa hari sampai Ramadan mulai (null kalau sudah lewat atau sedang berjalan). */
export function hariKeRamadan(today: string, mulai: string): number | null {
  const a = Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10));
  const b = Date.UTC(+mulai.slice(0, 4), +mulai.slice(5, 7) - 1, +mulai.slice(8, 10));
  const d = Math.round((b - a) / 86_400_000);
  return d > 0 ? d : null;
}

export type Porsi = { nama: string; kcal: number; proteinG: number; saran: string };

const ke = (n: number, k: number) => Math.round(n / k) * k;

/**
 * Bagi target harian ke tiga waktu makan saat puasa: sahur, berbuka, dan setelah tarawih.
 * Protein ditekankan di sahur (kenyang lebih lama) dan setelah tarawih (pemulihan otot).
 */
export function bagiRamadan(kcal: number, proteinG: number): Porsi[] {
  const bagi = [
    { nama: "Sahur", k: 0.35, p: 0.35, saran: "Protein cukup (telur, ayam, tempe/tahu, susu) + karbo kompleks (nasi, oat) supaya kenyang lebih lama. Minum air putih yang cukup." },
    { nama: "Berbuka", k: 0.4, p: 0.3, saran: "Mulai dari air dan kurma, jeda sebentar, lalu makan utama. Hindari langsung banyak gorengan dan manis." },
    { nama: "Setelah tarawih", k: 0.25, p: 0.35, saran: "Protein untuk pemulihan (telur, ikan, whey) dan camilan sehat. Minum air bertahap sampai tidur." },
  ];
  return bagi.map((b) => ({ nama: b.nama, kcal: ke(kcal * b.k, 10), proteinG: ke(proteinG * b.p, 5), saran: b.saran }));
}

export const SARAN_LATIHAN_RAMADAN =
  "Latihan paling enak menjelang buka (versi singkat/ringan, lalu langsung buka) atau 1-2 jam setelah tarawih. Volume dikurangi dan fokus jaga kekuatan, bukan nambah beban.";

/** Kurangi 1 set di gerakan non-inti yang setnya >= 3 (volume turun sedikit di mode Ramadan). */
export function kurangiVolumeRamadan(sets: number, isCore: boolean): number {
  return !isCore && sets >= 3 ? sets - 1 : sets;
}
