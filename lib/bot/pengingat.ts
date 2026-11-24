import { isoWeekday } from "../time.ts";

/** Ambang: sudah segini hari nggak timbang -> diingatkan walau bukan Minggu. */
export const HARI_LUPA_TIMBANG = 8;

/**
 * Pengingat timbang di pesan pagi: tiap Minggu, atau kalau sudah >= 8 hari nggak timbang,
 * atau belum pernah timbang sama sekali. Murni fungsi, gampang dites.
 */
export function pengingatTimbang(today: string, hariSejakTimbang: number | null): { baris: string[]; perlu: boolean } {
  if (isoWeekday(today) === 7) {
    return {
      perlu: true,
      baris: [
        "",
        "⚖️ Hari ini jadwal timbang mingguan. Timbang sekarang: habis bangun, ke toilet, belum makan/minum, sebelum olahraga (biar hasilnya bisa dibandingin).",
        "Catat lewat tombol di bawah, atau ketik /timbang 71.4 pagi. Sore nanti gua kirim laporan mingguannya.",
      ],
    };
  }
  if (hariSejakTimbang == null) {
    return { perlu: true, baris: ["", "⚖️ Belum ada timbangan. Timbang pagi hari (habis bangun, belum makan/minum) terus catat biar tren berat kelihatan."] };
  }
  if (hariSejakTimbang >= HARI_LUPA_TIMBANG) {
    return { perlu: true, baris: ["", `⚖️ Terakhir timbang ${hariSejakTimbang} hari lalu. Timbang hari ini pagi-pagi biar tren berat tetap kelihatan.`] };
  }
  return { perlu: false, baris: [] };
}
