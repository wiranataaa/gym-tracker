// Rekomendasi kardio (jalan di treadmill). Murni hitungan kode.
// Tujuannya kardio ringan (zona 2, masih bisa ngobrol) yang nggak ganggu pemulihan dan nggak
// terlalu membakar kalori di fase lean bulk, tapi membantu jantung dan menjaga perut tetap rapi.

export type Kardio = {
  menit: number;
  /** teks siap tampil */
  deskripsi: string;
  alasan: string;
};

export const KARDIO_DASAR_MENIT = 20;
export const KARDIO_MIN = 10;
export const KARDIO_MAKS = 45;
/** Hari latihan beban: Nata cuma punya ±1 jam, jadi kardio mentok di sini (hari recovery boleh lebih). */
export const KARDIO_MAKS_HARI_BEBAN = 20;

function ke5(n: number): number {
  return Math.round(n / 5) * 5;
}

export function rekomendasiKardio(args: {
  mode: "normal" | "singkat";
  /** hari recovery (Bonus F): kardio jadi menu utama */
  recovery?: boolean;
  /** laju berat kg/minggu dari rata-rata 7 hari; null = belum cukup data */
  lajuBeratKg: number | null;
  ramadan?: boolean;
}): Kardio {
  const { mode, recovery, lajuBeratKg, ramadan } = args;
  let menit = recovery ? 35 : KARDIO_DASAR_MENIT;
  const alasan: string[] = [];

  if (mode === "singkat" && !recovery) {
    menit = 10;
    alasan.push("versi singkat");
  } else if (ramadan) {
    menit = Math.min(menit, 15);
    alasan.push("mode Ramadan: dikurangi biar tenaga terjaga");
  } else if (lajuBeratKg != null && lajuBeratKg > 0.5) {
    menit += 10;
    alasan.push(
      recovery
        ? "berat naik cepat (>0,5 kg/minggu), kardio ditambah"
        : "berat naik cepat (>0,5 kg/minggu): kardio mentok 20 menit biar muat 1 jam, tambah jalan kaki di luar gym",
    );
  } else if (lajuBeratKg != null && lajuBeratKg < 0.2) {
    menit -= 5;
    alasan.push("berat naiknya lambat (<0,2 kg/minggu), kardio dikurangi biar kalori nggak kebakar");
  }

  menit = Math.min(recovery ? KARDIO_MAKS : KARDIO_MAKS_HARI_BEBAN, Math.max(KARDIO_MIN, ke5(menit)));
  return {
    menit,
    deskripsi: `Jalan di treadmill ${menit} menit, incline 8–10%, kecepatan 5–5,5 km/jam (santai, masih bisa ngobrol). Lakukan SETELAH angkat beban.`,
    alasan: alasan.join("; "),
  };
}
