// "Ganti gerakan" kalau alatnya penuh: berlaku untuk sesi itu saja, program nggak berubah.
// Murni kode (tanpa database), gampang dites.

export type Ganti = { dari: number; ke: number };

export type GerakanCalon = { id: number; name: string; muscle_group: string; kind: string; equipment: string };

/** Kelompok otot lain yang masih masuk akal sebagai pengganti, dipakai di urutan setelah kelompok yang sama. */
const TERKAIT: Record<string, string[]> = {
  Kaki: ["Hamstring & glutes", "Glutes"],
  "Hamstring & glutes": ["Glutes", "Kaki"],
  Glutes: ["Hamstring & glutes", "Kaki"],
  "Bahu belakang": ["Bahu"],
};

export const MAKS_CALON = 5;

/** Keluarga alat (buat mengutamakan alat yang BEDA dari yang lagi penuh). */
export function keluargaAlat(equipment: string): string {
  return equipment.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
}

/**
 * Daftar pengganti untuk satu gerakan, paling cocok dulu:
 * otot sama > otot terkait, lalu jenis sama (compound/isolation), lalu alat yang beda.
 * Gerakan yang sudah ada di menu sesi ini nggak ditawarkan.
 */
export function calonPengganti<T extends GerakanCalon>(asal: T, semua: T[], idDiMenu: number[], maks = MAKS_CALON): T[] {
  const terkait = TERKAIT[asal.muscle_group] ?? [];
  const nilai = (g: T) => [
    g.muscle_group === asal.muscle_group ? 0 : 1,
    g.kind === asal.kind ? 0 : 1,
    keluargaAlat(g.equipment) === keluargaAlat(asal.equipment) ? 1 : 0,
    // Area dumbbell di gym Nata sering penuh: kalau setara, taruh belakangan
    keluargaAlat(g.equipment) === "dumbbell" ? 1 : 0,
  ];
  return semua
    .filter((g) => g.id !== asal.id && !idDiMenu.includes(g.id) && (g.muscle_group === asal.muscle_group || terkait.includes(g.muscle_group)))
    .sort((a, b) => {
      const x = nilai(a);
      const y = nilai(b);
      for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i];
      return a.name.localeCompare(b.name);
    })
    .slice(0, maks);
}

export type ItemMenu = { exerciseId: number; sets: number; gantiDari: number | null };

/**
 * Terapkan daftar penggantian ke menu, berurutan.
 *  - Gerakan asal belum ada set: diganti di tempat, jumlah set tetap.
 *  - Sudah ada set: gerakan asal tetap tampil dengan set yang sudah dikerjakan, penggantinya
 *    mendapat sisa set dan diletakkan tepat setelahnya.
 * `buat` membentuk item pengganti (null kalau gerakannya nggak ketemu).
 */
export function terapkanGanti<T extends ItemMenu>(
  items: T[],
  daftar: Ganti[],
  selesai: Map<number, number>,
  buat: (asal: T, ke: number, sets: number) => T | null,
): T[] {
  const hasil = [...items];
  for (const g of daftar) {
    const i = hasil.findIndex((x) => x.exerciseId === g.dari);
    if (i < 0 || hasil.some((x) => x.exerciseId === g.ke)) continue;
    const asal = hasil[i];
    const sudah = selesai.get(g.dari) ?? 0;
    const sisa = asal.sets - sudah;
    if (sisa <= 0) continue;
    const baru = buat(asal, g.ke, sisa);
    if (!baru) continue;
    if (sudah === 0) hasil[i] = baru;
    else hasil.splice(i, 1, { ...asal, sets: sudah }, baru);
  }
  return hasil;
}

/**
 * Catat penggantian baru. Kalau yang diganti itu sendiri pengganti yang belum ada set-nya
 * (A→B lalu B→C), cukup disimpan A→C; balik ke asal (A→B lalu B→A) menghapus catatannya.
 */
export function tambahGanti(daftar: Ganti[], dari: number, ke: number, setSelesaiDari: number): Ganti[] {
  const i = daftar.findIndex((g) => g.ke === dari);
  if (setSelesaiDari === 0 && i >= 0) {
    const asal = daftar[i].dari;
    if (asal === ke) return daftar.filter((_, j) => j !== i);
    return daftar.map((g, j) => (j === i ? { dari: asal, ke } : g));
  }
  return [...daftar, { dari, ke }];
}

/** Batalkan pengganti `ke`. Hanya sah kalau pengganti itu belum ada set-nya. */
export function batalGanti(daftar: Ganti[], ke: number): Ganti[] {
  return daftar.filter((g) => g.ke !== ke);
}

/** Baca daftar dari database dengan aman (bentuk aneh diabaikan). */
export function bacaDaftarGanti(mentah: unknown): Ganti[] {
  if (!Array.isArray(mentah)) return [];
  return mentah.filter((g): g is Ganti => !!g && Number.isInteger((g as Ganti).dari) && Number.isInteger((g as Ganti).ke));
}
