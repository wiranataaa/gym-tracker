import { addDays, isoWeekday, namaHari, tglSingkat } from "../time.ts";

/** Tanggal hari latihan pertama SETELAH `today`. Kalau pengaturan harinya kosong, anggap besok. */
export function hariLatihanBerikutnya(today: string, hariLatihan: number[]): string {
  for (let i = 1; i <= 7; i++) {
    const d = addDays(today, i);
    if (hariLatihan.includes(isoWeekday(d))) return d;
  }
  return addDays(today, 1);
}

/** "Besok (Jumat)" kalau persis besok, selain itu "Senin, 30 Nov". */
export function labelKapan(today: string, tanggal: string): string {
  return tanggal === addDays(today, 1) ? `Besok (${namaHari(tanggal)})` : `${namaHari(tanggal)}, ${tglSingkat(tanggal)}`;
}
