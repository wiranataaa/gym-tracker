import { isoWeekday } from "../time.ts";

const PANDUAN =
  "Timbang di gym SEBELUM mulai latihan, pakaian ringan tanpa sepatu, dan usahakan kondisinya sama tiap minggu (biar angkanya bisa dibandingin).";

export type MasukanPengingat = {
  today: string;
  /** hari sejak timbangan terakhir; null = belum pernah */
  hariSejakTimbang: number | null;
  /** sudah ada timbangan di minggu ini (Senin-Minggu)? */
  sudahTimbangMingguIni: boolean;
  sesiSelesaiMingguIni: number;
  targetSesi: number;
};

/**
 * Pengingat timbang di pesan pagi. Nata nggak punya timbangan di kosan, jadi timbang di gym pada
 * hari latihan TERAKHIR tiap minggu (Senin-Jumat). Karena hari terakhirnya belum tentu Jumat:
 *  - Jumat: pengingat tegas kalau minggu ini belum timbang.
 *  - Kamis: pengingat lembut ("kalau ini sesi terakhir minggu ini ...").
 *  - Senin-Rabu: hanya kalau jatah sesi minggu itu sudah terpenuhi (berarti bisa jadi udah sesi terakhir).
 *  - Weekend: nggak ada pengingat (nggak ada timbangan).
 * Murni fungsi, gampang dites.
 */
export function pengingatTimbang(m: MasukanPengingat): { baris: string[]; perlu: boolean } {
  const hari = isoWeekday(m.today);
  const kosong = { baris: [] as string[], perlu: false };

  if (hari >= 6 || m.sudahTimbangMingguIni) return kosong;

  if (hari === 5) {
    return {
      perlu: true,
      baris: ["", `⚖️ Hari ini hari terakhir minggu ini dan lo belum timbang. ${PANDUAN}`, "Catat lewat tombol di bawah, atau ketik /timbang 71.4 gym. Minggu sore gua kirim laporan mingguannya."],
    };
  }
  if (hari === 4) {
    return {
      perlu: true,
      baris: ["", `⚖️ Kalau hari ini sesi latihan terakhir lo minggu ini, sekalian timbang. ${PANDUAN}`, "Catat lewat tombol di bawah, atau ketik /timbang 71.4 gym."],
    };
  }
  if (m.sesiSelesaiMingguIni >= m.targetSesi) {
    return {
      perlu: true,
      baris: ["", `⚖️ Jatah sesi minggu ini udah ${m.sesiSelesaiMingguIni}. Kalau hari ini yang terakhir, sekalian timbang. ${PANDUAN}`],
    };
  }
  if (m.hariSejakTimbang == null) {
    return { perlu: true, baris: ["", `⚖️ Lo belum pernah timbang di app ini. Mulai minggu ini ya. ${PANDUAN}`] };
  }
  return kosong;
}
