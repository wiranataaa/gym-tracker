// Tipe data untuk logika program latihan. Semua angka dihitung kode, bukan AI.

/** Satu working set (warm-up tidak dihitung). */
export type WorkingSet = {
  weightKg: number;
  reps: number;
  rpe?: number | null;
};

/** Satu sesi latihan untuk satu gerakan. date = "YYYY-MM-DD" (WIB). */
export type ExerciseSession = {
  date: string;
  sets: WorkingSet[];
};

/** Skema di program: jumlah set dan rentang reps (misal 3 set, 8-12). */
export type Scheme = {
  sets: number;
  repMin: number;
  repMax: number;
};

export type TargetReason =
  | "belum_ada_data"
  | "naik_beban"
  | "tambah_rep"
  | "tahan_beban"
  | "turun_beban"
  | "balik_libur_sebentar"
  | "balik_libur_lama";

export type Target = {
  /** null = belum ada riwayat, Nata pilih sendiri bebannya */
  weightKg: number | null;
  reps: number;
  sets: number;
  reason: TargetReason;
  /** Penjelasan singkat (bahasa santai) yang boleh langsung ditampilkan. */
  note: string;
};
