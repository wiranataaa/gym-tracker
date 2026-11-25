// Konsistensi latihan: titik per hari minggu ini, skor, dan colekan anti-bolos.
// Murni kode (tanpa AI, tanpa database) supaya gampang dites. Semua angka dihitung di sini.

import { awalMinggu, geser, skorKonsistensi } from "../report/hitung.ts";
import { isoWeekday, namaHari } from "../time.ts";

/** "sebelum" = hari sebelum sesi pertama yang pernah tercatat (belum mulai pakai app, bukan bolos). */
export type StatusHari = "selesai" | "hari_ini" | "lewat" | "nanti" | "sebelum";
export type TitikHari = { tanggal: string; label: string; status: StatusHari };

export type Minggu = {
  titik: TitikHari[];
  /** jumlah sesi selesai minggu ini (Senin-Minggu) */
  selesai: number;
  target: number;
  skor: number;
  /** hari latihan yang masih bisa dipakai: hari ini (kalau belum latihan) + hari kerja berikutnya */
  sisaHari: number;
  /** sesi yang masih dibutuhkan supaya jatah minggu ini terpenuhi */
  butuh: number;
  /** jatah minggu ini masih mungkin tercapai? */
  masihBisa: boolean;
};

type MasukanMinggu = {
  today: string;
  /** tanggal sesi selesai (boleh ada duplikat kalau sehari dua sesi) */
  tanggalSelesai: string[];
  /** hari latihan di pengaturan, 1 = Senin ... 7 = Minggu */
  hariLatihan: number[];
  target: number;
};

/** Ringkasan minggu berjalan: satu titik per hari latihan (plus hari lain yang kebetulan dipakai latihan). */
export function ringkasMinggu(m: MasukanMinggu): Minggu {
  const mulai = awalMinggu(m.today);
  const selesaiSet = new Set(m.tanggalSelesai);
  const titik: TitikHari[] = [];
  // Sebelum sesi pertama yang pernah tercatat, hari yang lewat belum dihitung bolos
  const awalPakai = [...m.tanggalSelesai].sort()[0] ?? m.today;

  for (let i = 0; i < 7; i++) {
    const tanggal = geser(mulai, i);
    const hariKerja = m.hariLatihan.includes(isoWeekday(tanggal));
    if (!hariKerja && !selesaiSet.has(tanggal)) continue;
    const status: StatusHari = selesaiSet.has(tanggal)
      ? "selesai"
      : tanggal === m.today
        ? "hari_ini"
        : tanggal < awalPakai
          ? "sebelum"
          : tanggal < m.today
            ? "lewat"
            : "nanti";
    titik.push({ tanggal, label: namaHari(tanggal).slice(0, 3), status });
  }

  const selesai = m.tanggalSelesai.filter((t) => t >= mulai && t <= geser(mulai, 6)).length;
  const sisaHari = titik.filter((t) => t.status === "hari_ini" || t.status === "nanti").length;
  const butuh = Math.max(0, m.target - selesai);
  return { titik, selesai, target: m.target, skor: skorKonsistensi(selesai, m.target), sisaHari, butuh, masihBisa: butuh <= sisaHari };
}

export type Colekan = {
  /** 0 = nggak perlu; 1 = lembut; 2 = tegas; 3 = lama libur (beban otomatis dikurangi) */
  level: 0 | 1 | 2 | 3;
  teks: string | null;
  /** hari kerja berturut-turut yang kosong sampai kemarin */
  hariKerjaKosong: number;
  /** hari sejak sesi terakhir; null = belum pernah latihan */
  hariSejak: number | null;
};

const TIDAK: Colekan = { level: 0, teks: null, hariKerjaKosong: 0, hariSejak: null };

function selisihHari(a: string, b: string): number {
  return Math.round((Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10)) - Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10))) / 86_400_000);
}

/**
 * Colekan anti-bolos untuk pagi hari. Hanya di hari latihan dan kalau hari ini belum latihan.
 * Dihitung dari hari KERJA yang kosong berturut-turut (weekend nggak dihitung, jadi Senin habis
 * Jumat latihan nggak dicolek). `abaikanHariIni` = hari ini sudah latihan, lagi latihan, atau sengaja di-skip.
 */
export function colekanPagi(m: { today: string; tanggalSelesai: string[]; hariLatihan: number[]; abaikanHariIni: boolean }): Colekan {
  if (m.abaikanHariIni || !m.hariLatihan.includes(isoWeekday(m.today))) return TIDAK;
  const selesaiSet = new Set(m.tanggalSelesai);
  if (selesaiSet.has(m.today)) return TIDAK;

  const sebelum = m.tanggalSelesai.filter((t) => t < m.today).sort();
  const terakhir = sebelum[sebelum.length - 1] ?? null;
  if (!terakhir) {
    return { level: 1, hariKerjaKosong: 0, hariSejak: null, teks: "Belum ada satu pun sesi tercatat. Sesi pertama itu yang paling susah dan paling penting. Hari ini mulai, versi 30 menit juga kehitung." };
  }

  const hariSejak = selisihHari(m.today, terakhir);
  let kosong = 0;
  for (let d = geser(m.today, -1); d > terakhir; d = geser(d, -1)) {
    if (m.hariLatihan.includes(isoWeekday(d))) kosong++;
  }

  if (hariSejak >= 7) {
    const pangkas = hariSejak >= 14 ? "sekitar 80%" : "sekitar 90%";
    return {
      level: 3,
      hariKerjaKosong: kosong,
      hariSejak,
      teks: `Udah ${hariSejak} hari nggak gym. Bebannya otomatis dipangkas jadi ${pangkas} dari terakhir, jadi nggak perlu takut balik. Yang berat itu cuma melangkah ke pintu gym. Hari ini langkahin aja, kalau capek pakai versi 30 menit.`,
    };
  }
  if (kosong >= 3) {
    return {
      level: 2,
      hariKerjaKosong: kosong,
      hariSejak,
      teks: `${kosong} hari kerja berturut-turut kosong (terakhir gym ${hariSejak} hari lalu). Makin ditunda makin berat mulainya. Hari ini cukup 3 gerakan compound: tap "Lagi capek, versi 30 menit" kalau energi tipis.`,
    };
  }
  if (kosong === 2) {
    return {
      level: 1,
      hariKerjaKosong: kosong,
      hariSejak,
      teks: "Udah 2 hari kerja nggak gym. Di titik ini biasanya on-off mulai. Hari ini datang aja, versi 30 menit juga kehitung.",
    };
  }
  return { ...TIDAK, hariKerjaKosong: kosong, hariSejak };
}

/**
 * Colekan sore/malam: dikirim kalau hari ini hari latihan, belum ada sesi, dan jatah minggu ini belum penuh.
 * Mengembalikan null kalau nggak perlu dicolek.
 */
export function colekanMalam(m: { today: string; minggu: Minggu; hariLatihan: number[]; abaikanHariIni: boolean }): string | null {
  if (m.abaikanHariIni || !m.hariLatihan.includes(isoWeekday(m.today))) return null;
  const { selesai, target, butuh, sisaHari, masihBisa } = m.minggu;
  if (butuh <= 0) return null;
  if (m.minggu.titik.some((t) => t.tanggal === m.today && t.status === "selesai")) return null;

  const status = `Minggu ini baru ${selesai}/${target} sesi.`;
  if (!masihBisa) {
    return `Hari ini belum ada sesi tercatat. ${status} Jatah minggu ini udah nggak kekejar, tapi sesi tetap kehitung. Jangan biarin minggunya nol: 30 menit pun lebih baik daripada nggak sama sekali.`;
  }
  if (sisaHari === 1) {
    return `Hari ini belum ada sesi tercatat dan ini kesempatan terakhir minggu ini. ${status} Kurang ${butuh}. Kalau malam ini rencananya gym, gas. Capek? Versi 30 menit aja.`;
  }
  return `Hari ini belum ada sesi tercatat. ${status} Kurang ${butuh}, sisa ${sisaHari} hari latihan (termasuk hari ini). Kalau malam ini rencananya gym, gas. Capek? Versi 30 menit aja.`;
}

const IKON: Record<StatusHari, string> = { selesai: "✅", hari_ini: "👉", lewat: "❌", nanti: "▫️", sebelum: "▫️" };

/** Satu baris untuk bot: "Sen ✅ · Sel ❌ · Rab 👉 · Kam ▫️ · Jum ▫️". */
export function barisTitik(titik: TitikHari[]): string {
  return titik.map((t) => `${t.label} ${IKON[t.status]}`).join(" · ");
}
