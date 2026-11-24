// Penjaga "AI nggak boleh mengarang angka": setiap angka di teks AI harus berasal dari data
// hasil hitungan kode. Angka kecil (< 10, bilangan bulat) dibebaskan karena sering dipakai
// sebagai kata biasa ("2 poin", "1 hal", skala energi).

/** Ambil semua angka dari teks. Mengerti format Indonesia: 1.234 (ribuan) dan 62,5 (desimal). */
export function ekstrakAngka(teks: string): number[] {
  const out: number[] = [];
  for (const m of teks.matchAll(/\d+(?:\.\d{3})*(?:,\d+)?|\d+(?:\.\d+)?/g)) {
    const raw = m[0];
    const normal = /^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(raw) ? raw.replace(/\./g, "").replace(",", ".") : raw.replace(",", ".");
    const n = Number(normal);
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

/** Kumpulkan semua angka dari data (objek bersarang) sebagai himpunan yang diizinkan. */
export function angkaDiData(data: unknown): number[] {
  const out: number[] = [];
  const jalan = (v: unknown) => {
    if (typeof v === "number" && Number.isFinite(v)) out.push(v);
    else if (typeof v === "string") out.push(...ekstrakAngka(v));
    else if (Array.isArray(v)) v.forEach(jalan);
    else if (v && typeof v === "object") Object.values(v).forEach(jalan);
  };
  jalan(data);
  return out;
}

function mirip(a: number, b: number): boolean {
  return Math.abs(a - b) <= Math.max(0.05, Math.abs(b) * 0.005);
}

/**
 * Kembalikan angka di `teks` yang TIDAK ada di data. Selisih kecil (pembulatan) dimaklumi, dan
 * angka turunan sederhana (selisih dua angka data, persen) diizinkan lewat `tambahan`.
 */
export function angkaTidakDikenal(teks: string, data: unknown, tambahan: number[] = []): number[] {
  const boleh = [...angkaDiData(data), ...tambahan];
  return ekstrakAngka(teks).filter((n) => {
    if (Number.isInteger(n) && n < 10) return false;
    return !boleh.some((b) => mirip(n, b));
  });
}
