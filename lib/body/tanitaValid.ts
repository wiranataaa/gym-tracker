// Pemeriksaan hasil baca layar Tanita. Murni kode: AI cuma membaca angka, kodelah yang menilai
// apakah angkanya masuk akal.

export type KomposisiBaca = {
  tanggal: string | null; // "YYYY-MM-DD"
  jam: string | null; // "HH:MM"
  beratKg: number | null;
  bodyFatPct: number | null;
  muscleMassKg: number | null;
  muscleScore: number | null;
  bmi: number | null;
  muscleQuality: number | null;
  visceralFat: number | null;
  boneMassKg: number | null;
  bodyWaterPct: number | null;
  bmrKcal: number | null;
  metabolicAge: number | null;
};

export type HasilValidasi = {
  /** masalah serius: angka hampir pasti salah baca, jangan disimpan tanpa dikoreksi */
  masalah: string[];
  /** peringatan: kemungkinan benar tapi layak dicek */
  peringatan: string[];
};

const RENTANG: { kunci: keyof KomposisiBaca; nama: string; min: number; maks: number; satuan: string }[] = [
  { kunci: "beratKg", nama: "Berat", min: 30, maks: 250, satuan: "kg" },
  { kunci: "bodyFatPct", nama: "Body fat", min: 3, maks: 60, satuan: "%" },
  { kunci: "muscleMassKg", nama: "Massa otot", min: 15, maks: 120, satuan: "kg" },
  { kunci: "bmi", nama: "BMI", min: 12, maks: 55, satuan: "" },
  { kunci: "visceralFat", nama: "Visceral fat", min: 1, maks: 30, satuan: "" },
  { kunci: "boneMassKg", nama: "Massa tulang", min: 1, maks: 6, satuan: "kg" },
  { kunci: "bodyWaterPct", nama: "Body water", min: 30, maks: 75, satuan: "%" },
  { kunci: "bmrKcal", nama: "BMR", min: 900, maks: 3500, satuan: "kcal" },
  { kunci: "metabolicAge", nama: "Usia metabolik", min: 10, maks: 90, satuan: "" },
];

export function validasiKomposisi(d: KomposisiBaca, tinggiCm: number): HasilValidasi {
  const masalah: string[] = [];
  const peringatan: string[] = [];

  if (d.beratKg == null) masalah.push("Berat nggak terbaca.");

  for (const r of RENTANG) {
    const v = d[r.kunci];
    if (typeof v === "number" && (v < r.min || v > r.maks)) {
      masalah.push(`${r.nama} ${v}${r.satuan ? " " + r.satuan : ""} di luar rentang wajar (${r.min}-${r.maks}).`);
    }
  }

  // BMI harus cocok dengan berat dan tinggi (pembaca sering tertukar kolom)
  if (d.beratKg != null && d.bmi != null && tinggiCm > 0) {
    const hitung = d.beratKg / (tinggiCm / 100) ** 2;
    if (Math.abs(hitung - d.bmi) > 1.2) {
      masalah.push(`BMI ${d.bmi} nggak cocok dengan berat ${d.beratKg} kg dan tinggi ${tinggiCm} cm (seharusnya ±${hitung.toFixed(1)}). Kemungkinan ada angka yang tertukar.`);
    }
  }

  if (d.beratKg != null && d.muscleMassKg != null && d.muscleMassKg >= d.beratKg) {
    masalah.push("Massa otot nggak mungkin lebih besar dari berat badan.");
  }
  if (d.beratKg != null && d.boneMassKg != null && d.boneMassKg > d.beratKg * 0.1) {
    peringatan.push("Massa tulang kelihatan terlalu besar dibanding berat. Cek lagi.");
  }
  if (d.bodyFatPct != null && d.bodyWaterPct != null && d.bodyFatPct + d.bodyWaterPct > 100) {
    masalah.push("Body fat dan body water kalau dijumlah lebih dari 100%.");
  }

  const kosong = RENTANG.filter((r) => r.kunci !== "beratKg" && d[r.kunci] == null).map((r) => r.nama);
  if (kosong.length > 0) peringatan.push(`Nggak terbaca: ${kosong.join(", ")}.`);

  if (d.tanggal && !/^\d{4}-\d{2}-\d{2}$/.test(d.tanggal)) peringatan.push("Format tanggal nggak jelas, pakai waktu sekarang.");

  return { masalah, peringatan };
}

/** Waktu ukur dari layar (WIB). Kalau nggak ada atau di masa depan, pakai sekarang. */
export function waktuUkur(d: Pick<KomposisiBaca, "tanggal" | "jam">, sekarang: Date = new Date()): string {
  if (d.tanggal && /^\d{4}-\d{2}-\d{2}$/.test(d.tanggal)) {
    const jam = d.jam && /^\d{1,2}:\d{2}$/.test(d.jam) ? d.jam.padStart(5, "0") : "07:00";
    const t = new Date(`${d.tanggal}T${jam}:00+07:00`);
    if (!Number.isNaN(t.getTime()) && t.getTime() <= sekarang.getTime() + 3_600_000) return t.toISOString();
  }
  return sekarang.toISOString();
}
