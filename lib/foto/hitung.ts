// Foto progres bulanan: pengelompokan per tanggal, pasangan awal-vs-terbaru, dan pengingat.
// Murni kode (tanpa database) supaya gampang dites.

import { daysBetween } from "../body/trend.ts";
import { isoWeekday } from "../time.ts";

export type Sudut = "depan" | "samping" | "belakang";
export const SUDUT: { nilai: Sudut; label: string }[] = [
  { nilai: "depan", label: "Depan" },
  { nilai: "samping", label: "Samping" },
  { nilai: "belakang", label: "Belakang" },
];
export const sudutValid = (s: unknown): s is Sudut => SUDUT.some((x) => x.nilai === s);

export type FotoBaris = { id: number; tanggal: string; sudut: Sudut; path: string; beratKg: number | null };
export type KelompokFoto = {
  tanggal: string;
  /** berat dari foto mana pun di tanggal itu yang punya angka */
  beratKg: number | null;
  foto: Partial<Record<Sudut, { id: number; path: string }>>;
};

/** Kelompokkan foto per tanggal, tanggal terbaru dulu. */
export function kelompokkan(baris: FotoBaris[]): KelompokFoto[] {
  const m = new Map<string, KelompokFoto>();
  for (const b of baris) {
    const g = m.get(b.tanggal) ?? { tanggal: b.tanggal, beratKg: null, foto: {} };
    g.foto[b.sudut] = { id: b.id, path: b.path };
    if (g.beratKg == null && b.beratKg != null) g.beratKg = b.beratKg;
    m.set(b.tanggal, g);
  }
  return [...m.values()].sort((a, b) => (a.tanggal < b.tanggal ? 1 : -1));
}

export type Banding = {
  sudut: Sudut;
  awal: { tanggal: string; path: string; beratKg: number | null };
  terbaru: { tanggal: string; path: string; beratKg: number | null };
  hari: number;
  /** selisih berat (terbaru - awal), null kalau salah satunya nggak punya angka */
  selisihKg: number | null;
};

/** Foto terlama vs terbaru untuk satu sudut. null kalau sudut itu belum punya minimal dua tanggal berbeda. */
export function bandingkan(grup: KelompokFoto[], sudut: Sudut): Banding | null {
  const ada = grup.filter((g) => g.foto[sudut]); // terbaru dulu
  if (ada.length < 2) return null;
  const terbaru = ada[0];
  const awal = ada[ada.length - 1];
  return {
    sudut,
    awal: { tanggal: awal.tanggal, path: awal.foto[sudut]!.path, beratKg: awal.beratKg },
    terbaru: { tanggal: terbaru.tanggal, path: terbaru.foto[sudut]!.path, beratKg: terbaru.beratKg },
    hari: daysBetween(awal.tanggal, terbaru.tanggal),
    selisihKg: awal.beratKg != null && terbaru.beratKg != null ? Math.round((terbaru.beratKg - awal.beratKg) * 10) / 10 : null,
  };
}

/** Hari sejak foto terakhir; null kalau belum pernah. */
export function hariSejakFoto(today: string, tanggalTerakhir: string | null): number | null {
  return tanggalTerakhir ? daysBetween(tanggalTerakhir, today) : null;
}

export const JEDA_FOTO_HARI = 28;

const TIPS = "Tipsnya: pagi sebelum latihan, cahaya dan jarak kamera sama tiap bulan, pose rileks (jangan flex), pakai bawahan yang sama.";

/**
 * Pengingat foto progres di pesan pagi. Hari kerja saja:
 *  - belum pernah foto: Senin/Rabu/Jumat (foto awal itu pembanding paling berharga)
 *  - sudah pernah: Jumat, kalau udah >= 28 hari
 * Mengembalikan baris pesan, atau null kalau nggak perlu.
 */
export function pengingatFoto(today: string, tanggalTerakhir: string | null): string[] | null {
  const hari = isoWeekday(today);
  if (hari > 5) return null;
  const sejak = hariSejakFoto(today, tanggalTerakhir);

  if (sejak == null) {
    if (![1, 3, 5].includes(hari)) return null;
    return ["", `📸 Belum ada foto progres. Ambil foto awal (depan, samping, belakang) hari ini, biar bulan depan kelihatan bedanya. ${TIPS}`];
  }
  if (hari === 5 && sejak >= JEDA_FOTO_HARI) {
    return ["", `📸 Udah ${sejak} hari sejak foto progres terakhir. Waktunya foto bulanan. ${TIPS}`];
  }
  return null;
}
