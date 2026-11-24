// Saran makanan tinggi protein buat nutup kekurangan hari ini. Murni hitungan kode (nilai gizi umum),
// jadi gratis dan konsisten. Nilai per satuan adalah perkiraan umum, bukan angka presisi.

type Sumber = {
  nama: string;
  satuan: string;
  proteinG: number;
  kcal: number;
  /** batas wajar jumlah satuan dimakan dalam sisa hari */
  maks: number;
};

export const SUMBER_PROTEIN: Sumber[] = [
  { nama: "Dada ayam matang", satuan: "100 g", proteinG: 31, kcal: 165, maks: 3 },
  { nama: "Telur", satuan: "butir", proteinG: 6, kcal: 75, maks: 6 },
  { nama: "Tempe", satuan: "100 g (±4 potong kecil)", proteinG: 19, kcal: 270, maks: 3 },
  { nama: "Tahu putih", satuan: "100 g (±2 potong)", proteinG: 8, kcal: 76, maks: 4 },
  { nama: "Susu", satuan: "gelas 250 ml", proteinG: 8, kcal: 150, maks: 3 },
  { nama: "Whey protein", satuan: "scoop", proteinG: 24, kcal: 120, maks: 2 },
  { nama: "Tuna kaleng (tiriskan)", satuan: "kaleng ±100 g", proteinG: 25, kcal: 120, maks: 2 },
  { nama: "Ikan (kembung/salmon)", satuan: "100 g", proteinG: 22, kcal: 160, maks: 3 },
];

export type Opsi = { nama: string; jumlah: number; satuan: string; proteinG: number; kcal: number };

function opsi(s: Sumber, jumlah: number): Opsi {
  return { nama: s.nama, jumlah, satuan: s.satuan, proteinG: Math.round(s.proteinG * jumlah), kcal: Math.round(s.kcal * jumlah) };
}

/** Berapa satuan satu sumber supaya sendirian nutup kekurangan. null kalau melebihi batas wajar. */
export function opsiTunggal(kekuranganG: number): Opsi[] {
  const out: Opsi[] = [];
  for (const s of SUMBER_PROTEIN) {
    const n = Math.ceil(kekuranganG / s.proteinG);
    if (n >= 1 && n <= s.maks) out.push(opsi(s, n));
  }
  // Paling hemat kalori per gram protein dulu
  return out.sort((a, b) => a.kcal / a.proteinG - b.kcal / b.proteinG);
}

/** Campuran dua sumber paling "ramping", masing-masing menutup separuh. */
export function opsiCampuran(kekuranganG: number): Opsi[] | null {
  const ramping = [...SUMBER_PROTEIN].sort((a, b) => a.kcal / a.proteinG - b.kcal / b.proteinG);
  const [a, b] = [ramping[0], ramping[1]];
  const separuh = kekuranganG / 2;
  const na = Math.max(1, Math.round(separuh / a.proteinG));
  const nb = Math.max(1, Math.round(separuh / b.proteinG));
  if (na > a.maks || nb > b.maks) return null;
  return [opsi(a, na), opsi(b, nb)];
}

export type Saran = {
  kekuranganG: number;
  /** kekurangan terlalu besar buat dikejar semua dalam sisa hari */
  terlaluBanyak: boolean;
  tunggal: Opsi[];
  campuran: Opsi[] | null;
};

/** Batas kekurangan yang masih masuk akal dikejar di malam hari. */
export const BATAS_KEKURANGAN_G = 70;

export function saranProtein(kekuranganG: number): Saran {
  const k = Math.max(0, Math.round(kekuranganG));
  const target = Math.min(k, BATAS_KEKURANGAN_G);
  return {
    kekuranganG: k,
    terlaluBanyak: k > BATAS_KEKURANGAN_G,
    tunggal: opsiTunggal(target).slice(0, 3),
    campuran: target > 0 ? opsiCampuran(target) : null,
  };
}

export function labelOpsi(o: Opsi): string {
  return `${o.jumlah} ${o.satuan} ${o.nama} (${o.proteinG} g protein, ±${o.kcal} kcal)`;
}
