// "Lewati sisa set": kalau udah nggak kuat (atau alatnya penuh), gerakan itu dianggap beres untuk
// sesi ini. Set yang sudah dikerjakan tetap tercatat. Murni kode, gampang dites.

export type RencanaGerakan = { exerciseId: number; sets: number };

/** Jumlah set kerja yang sudah dikerjakan per gerakan. */
export function hitungSet(idGerakanPerSet: number[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const id of idGerakanPerSet) m.set(id, (m.get(id) ?? 0) + 1);
  return m;
}

export function gerakanBeres(g: RencanaGerakan, selesai: Map<number, number>, dilewati: number[]): boolean {
  return dilewati.includes(g.exerciseId) || (selesai.get(g.exerciseId) ?? 0) >= g.sets;
}

/** Total set yang masih jadi rencana sesi ini (set yang dilewati nggak dihitung) dan yang sudah beres. */
export function totalSet(menu: RencanaGerakan[], selesai: Map<number, number>, dilewati: number[]): { rencana: number; beres: number } {
  let rencana = 0;
  let beres = 0;
  for (const g of menu) {
    const n = Math.min(selesai.get(g.exerciseId) ?? 0, g.sets);
    beres += n;
    rencana += dilewati.includes(g.exerciseId) ? n : g.sets;
  }
  return { rencana, beres };
}

/**
 * Gerakan yang "sedang dikerjakan" (buat tombol lewati di bot): gerakan dari set terakhir kalau belum
 * beres; kalau sudah beres atau belum ada set, gerakan pertama di menu yang belum beres.
 */
export function gerakanSekarang<T extends RencanaGerakan>(menu: T[], idGerakanPerSet: number[], dilewati: number[]): T | undefined {
  const selesai = hitungSet(idGerakanPerSet);
  const terakhir = menu.find((g) => g.exerciseId === idGerakanPerSet[idGerakanPerSet.length - 1]);
  if (terakhir && !gerakanBeres(terakhir, selesai, dilewati)) return terakhir;
  return menu.find((g) => !gerakanBeres(g, selesai, dilewati));
}

export function ubahDilewati(daftar: number[], exerciseId: number, lewati: boolean): number[] {
  const tanpa = daftar.filter((x) => x !== exerciseId);
  return lewati ? [...tanpa, exerciseId] : tanpa;
}

/** Teks rekap: "Overhead Press: berhenti di 2 dari 3 set" atau "Leg Press: nggak dikerjakan". */
export function teksDilewati(nama: string, selesai: number, rencana: number | null): string {
  if (selesai === 0) return `${nama}: nggak dikerjakan`;
  return rencana != null && rencana > selesai ? `${nama}: berhenti di ${selesai} dari ${rencana} set` : `${nama}: berhenti di ${selesai} set`;
}
