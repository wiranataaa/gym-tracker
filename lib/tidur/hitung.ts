// Hitungan tidur (murni kode, tanpa database): baca jam, hitung durasi, nilai cukup/kurang.
// Jam tidur boleh sebelum tengah malam (23:30) atau sesudahnya (00:30); tanggal tidurnya dicari dari jam bangun.

export const TARGET_TIDUR_JAM = 7;
export const MIN_DURASI_MENIT = 30;
export const MAKS_DURASI_MENIT = 16 * 60;

/** "23:30", "23.30", "2330", "6", "6:05" -> menit sejak tengah malam, atau null kalau bukan jam. */
export function bacaJam(raw: string): number | null {
  const s = raw.trim();
  let jam: number;
  let menit = 0;
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(\d{1,2})[:.](\d{2})$/))) {
    jam = Number(m[1]);
    menit = Number(m[2]);
  } else if ((m = s.match(/^(\d{2})(\d{2})$/))) {
    jam = Number(m[1]);
    menit = Number(m[2]);
  } else if ((m = s.match(/^(\d{1,2})$/))) {
    jam = Number(m[1]);
  } else {
    return null;
  }
  if (!(jam >= 0 && jam <= 23 && menit >= 0 && menit <= 59)) return null;
  return jam * 60 + menit;
}

export function fmtJam(menitDariTengahMalam: number): string {
  const m = ((menitDariTengahMalam % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Jam "HH:MM" di WIB dari sebuah waktu ISO. */
export function jamWIB(iso: string): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
}

function addDays(date: string, n: number): string {
  const t = Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)) + n * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

const wibIso = (date: string, menit: number) => `${date}T${fmtJam(menit)}:00+07:00`;

export type WaktuTidur = { sleptAt: string; wokeAt: string; durasiMenit: number };

/**
 * Susun waktu tidur dari tanggal bangun + jam tidur + jam bangun ("HH:MM").
 * Kalau jam tidur lebih besar dari jam bangun (23:30 -> 06:00) berarti tidurnya malam sebelumnya.
 */
export function susunWaktuTidur(tanggalBangun: string, jamTidur: string, jamBangun: string): { ok: true; waktu: WaktuTidur } | { ok: false; error: string } {
  const t = bacaJam(jamTidur);
  const b = bacaJam(jamBangun);
  if (t == null || b == null) return { ok: false, error: "Jamnya nggak terbaca. Contoh: 23:30 dan 06:00" };
  if (t === b) return { ok: false, error: "Jam tidur dan jam bangun nggak boleh sama" };
  const tanggalTidur = t > b ? addDays(tanggalBangun, -1) : tanggalBangun;
  const sleptAt = wibIso(tanggalTidur, t);
  const wokeAt = wibIso(tanggalBangun, b);
  const durasiMenit = Math.round((new Date(wokeAt).getTime() - new Date(sleptAt).getTime()) / 60_000);
  if (durasiMenit < MIN_DURASI_MENIT) return { ok: false, error: "Durasi tidurnya terlalu pendek, cek lagi jamnya" };
  if (durasiMenit > MAKS_DURASI_MENIT) return { ok: false, error: "Durasi tidurnya lebih dari 16 jam, cek lagi jamnya" };
  return { ok: true, waktu: { sleptAt, wokeAt, durasiMenit } };
}

/** 390 -> "6 jam 30 menit"; 420 -> "7 jam" */
export function fmtDurasi(menit: number): string {
  const j = Math.floor(menit / 60);
  const m = menit % 60;
  if (j === 0) return `${m} menit`;
  return m === 0 ? `${j} jam` : `${j} jam ${m} menit`;
}

export const jamDesimal = (menit: number) => Math.round((menit / 60) * 10) / 10;

export type NilaiTidur = { level: "kurang" | "pas" | "cukup"; label: string };

/** Cukup = >= target (7 jam); pas = 6-7 jam; kurang = < 6 jam. */
export function nilaiTidur(menit: number, targetJam = TARGET_TIDUR_JAM): NilaiTidur {
  if (menit >= targetJam * 60) return { level: "cukup", label: "Cukup" };
  if (menit >= (targetJam - 1) * 60) return { level: "pas", label: "Agak kurang" };
  return { level: "kurang", label: "Kurang" };
}

export type TebakanTidur = { jamTidur: string; jamBangun: string; catatan: string };

const KATA_SAMBUNG = new Set(["jam", "tidur", "bangun", "sampai", "s/d", "sd", "-", "–", "→", "ke", "dan", "lalu", "terus", "pukul", "wib"]);

/**
 * Baca argumen /tidur: "23:30 6:00 nyenyak banget" -> tidur 23:30, bangun 06:00, catatan "nyenyak banget".
 * Dua token jam pertama dipakai (tidur dulu, lalu bangun); sisanya jadi catatan.
 */
export function bacaTidurTeks(arg: string): TebakanTidur | null {
  const jam: number[] = [];
  const sisa: string[] = [];
  for (const tok of arg.trim().split(/\s+/).filter(Boolean)) {
    const bersih = tok.replace(/[,;]+$/g, "");
    if (jam.length < 2) {
      const j = bacaJam(bersih);
      if (j != null) {
        jam.push(j);
        continue;
      }
      if (KATA_SAMBUNG.has(bersih.toLowerCase())) continue;
    }
    sisa.push(tok);
  }
  if (jam.length < 2) return null;
  return { jamTidur: fmtJam(jam[0]), jamBangun: fmtJam(jam[1]), catatan: sisa.join(" ").trim().slice(0, 300) };
}

/** Rata-rata durasi (menit) dari daftar; null kalau kosong. */
export function rataMenit(durasi: number[]): number | null {
  if (durasi.length === 0) return null;
  return Math.round(durasi.reduce((a, b) => a + b, 0) / durasi.length);
}
