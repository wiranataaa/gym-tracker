import { test } from "node:test";
import assert from "node:assert/strict";
import { validasiKomposisi, waktuUkur, type KomposisiBaca } from "./tanitaValid.ts";

// Data asli dari timbangan Tanita Nata (30 Okt 2026), sudah dikoreksi dari pergeseran baris
const asli: KomposisiBaca = {
  tanggal: "2026-10-30",
  jam: "17:52",
  beratKg: 71.1,
  bodyFatPct: 19.5,
  muscleMassKg: 54.25,
  muscleScore: 0,
  bmi: 22.4,
  muscleQuality: 68,
  visceralFat: 7.5,
  boneMassKg: 3.0,
  bodyWaterPct: 53.7,
  bmrKcal: 1625,
  metabolicAge: 24,
};

test("data Tanita asli lolos tanpa masalah", () => {
  const v = validasiKomposisi(asli, 178);
  assert.deepEqual(v.masalah, []);
  assert.deepEqual(v.peringatan, []);
});

test("pergeseran baris yang belum dikoreksi (nilai tertukar) ketahuan", () => {
  // Bentuk salah baca: BMI jadi 0, Muscle quality jadi 22.4, dst. (nilai geser satu baris)
  const salah: KomposisiBaca = { ...asli, muscleScore: 22.4, bmi: 0, muscleQuality: 68, visceralFat: 7.5, boneMassKg: 7.5, bodyWaterPct: 3.0, bmrKcal: 53.7, metabolicAge: 1625 };
  const v = validasiKomposisi(salah, 178);
  assert.ok(v.masalah.length >= 3, v.masalah.join(" | "));
});

test("BMI yang nggak cocok dengan berat dan tinggi jadi masalah", () => {
  const v = validasiKomposisi({ ...asli, bmi: 31.2 }, 178);
  assert.ok(v.masalah.some((m) => m.includes("BMI")));
});

test("berat hilang atau massa otot > berat jadi masalah", () => {
  assert.ok(validasiKomposisi({ ...asli, beratKg: null }, 178).masalah.some((m) => m.includes("Berat")));
  assert.ok(validasiKomposisi({ ...asli, muscleMassKg: 80 }, 178).masalah.some((m) => m.includes("otot")));
});

test("nilai yang nggak terbaca jadi peringatan, bukan masalah", () => {
  const v = validasiKomposisi({ ...asli, bodyWaterPct: null, bmrKcal: null }, 178);
  assert.deepEqual(v.masalah, []);
  assert.ok(v.peringatan.join(" ").includes("Body water"));
});

test("waktuUkur: pakai tanggal+jam dari layar (WIB), fallback ke sekarang", () => {
  const now = new Date("2026-11-25T03:00:00Z");
  assert.equal(waktuUkur({ tanggal: "2026-10-30", jam: "17:52" }, now), "2026-10-30T10:52:00.000Z");
  assert.equal(waktuUkur({ tanggal: null, jam: null }, now), now.toISOString());
  assert.equal(waktuUkur({ tanggal: "2027-01-01", jam: "10:00" }, now), now.toISOString()); // masa depan ditolak
  assert.equal(waktuUkur({ tanggal: "ngawur", jam: null }, now), now.toISOString());
});
