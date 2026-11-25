// Lama istirahat antar set (detik), dihitung kode. Compound berat butuh istirahat lebih lama dari isolation;
// set yang terasa mentok (RPE 9-10) butuh lebih lama lagi; versi singkat (30 menit) dipangkas supaya muat.

export type JenisGerakan = "compound" | "isolation";

export const ISTIRAHAT_MIN_DETIK = 15;
export const ISTIRAHAT_MAKS_DETIK = 600;

export function istirahatDetik(args: { jenis: JenisGerakan; pemanasan?: boolean; rpe?: number | null; singkat?: boolean }): number {
  if (args.pemanasan) return 45;
  const mentok = args.rpe != null && args.rpe >= 9;
  if (args.singkat) return args.jenis === "compound" ? (mentok ? 120 : 90) : mentok ? 75 : 60;
  if (args.jenis === "compound") return mentok ? 180 : 120;
  return mentok ? 105 : 75;
}

/** Sisa detik sampai `akhirMs`, dibulatkan ke atas, minimal 0. */
export function sisaDetik(akhirMs: number, sekarangMs: number): number {
  return Math.max(0, Math.ceil((akhirMs - sekarangMs) / 1000));
}

/** 125 -> "2:05" */
export function fmtMenitDetik(detik: number): string {
  const d = Math.max(0, Math.round(detik));
  return `${Math.floor(d / 60)}:${String(d % 60).padStart(2, "0")}`;
}

/** Geser total waktu istirahat (tombol ±15 detik) dengan batas wajar. */
export function geserTotal(totalDetik: number, selisih: number): number {
  return Math.min(ISTIRAHAT_MAKS_DETIK, Math.max(ISTIRAHAT_MIN_DETIK, totalDetik + selisih));
}
