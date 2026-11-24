import { test } from "node:test";
import assert from "node:assert/strict";
import { computeTarget, daysBetween, roundToStep } from "./progression.ts";
import type { ExerciseSession, Scheme } from "./types.ts";

const scheme: Scheme = { sets: 3, repMin: 6, repMax: 10 };
const sets = (weightKg: number, reps: number[], rpe?: number) =>
  reps.map((r) => ({ weightKg, reps: r, rpe: rpe ?? null }));
const session = (date: string, weightKg: number, reps: number[], rpe?: number): ExerciseSession => ({
  date,
  sets: sets(weightKg, reps, rpe),
});

test("belum ada riwayat: beban null, reps di batas bawah", () => {
  const t = computeTarget([], scheme, 2.5, "2026-11-25");
  assert.equal(t.weightKg, null);
  assert.equal(t.reps, 6);
  assert.equal(t.reason, "belum_ada_data");
});

test("semua set di batas atas: naik beban +increment, reps balik ke batas bawah", () => {
  const t = computeTarget([session("2026-11-23", 60, [10, 10, 10])], scheme, 2.5, "2026-11-26");
  assert.equal(t.weightKg, 62.5);
  assert.equal(t.reps, 6);
  assert.equal(t.reason, "naik_beban");
});

test("compound bawah naik +5 kg", () => {
  const t = computeTarget([session("2026-11-23", 100, [8, 8, 8])], { sets: 3, repMin: 6, repMax: 8 }, 5, "2026-11-26");
  assert.equal(t.weightKg, 105);
});

test("belum semua di batas atas: beban sama, target = rep terendah + 1", () => {
  const t = computeTarget([session("2026-11-23", 60, [10, 9, 8])], scheme, 2.5, "2026-11-26");
  assert.equal(t.weightKg, 60);
  assert.equal(t.reps, 9);
  assert.equal(t.reason, "tambah_rep");
});

test("rep di batas atas tapi RPE 9: tahan beban", () => {
  const t = computeTarget([session("2026-11-23", 60, [10, 10, 10], 9)], scheme, 2.5, "2026-11-26");
  assert.equal(t.weightKg, 60);
  assert.equal(t.reps, 10);
  assert.equal(t.reason, "tahan_beban");
});

test("RPE 8 masih boleh naik", () => {
  const t = computeTarget([session("2026-11-23", 60, [10, 10, 10], 8)], scheme, 2.5, "2026-11-26");
  assert.equal(t.reason, "naik_beban");
});

test("set kurang dari rencana (misal mode singkat): belum naik beban", () => {
  const t = computeTarget([session("2026-11-23", 60, [10, 10])], scheme, 2.5, "2026-11-26");
  assert.equal(t.weightKg, 60);
  assert.equal(t.reason, "tahan_beban");
});

test("gagal batas bawah 2 sesi berturut-turut: turun ~7,5%", () => {
  const t = computeTarget(
    [session("2026-11-23", 60, [5, 5, 4]), session("2026-11-20", 60, [5, 4, 4])],
    scheme,
    2.5,
    "2026-11-26",
  );
  assert.equal(t.weightKg, 55);
  assert.equal(t.reps, 6);
  assert.equal(t.reason, "turun_beban");
});

test("gagal cuma 1 sesi: belum turun beban", () => {
  const t = computeTarget(
    [session("2026-11-23", 60, [5, 5, 4]), session("2026-11-20", 60, [8, 8, 7])],
    scheme,
    2.5,
    "2026-11-26",
  );
  assert.equal(t.weightKg, 60);
  assert.equal(t.reps, 6);
  assert.equal(t.reason, "tambah_rep");
});

test("libur 7-13 hari: ±90% beban terakhir", () => {
  const t = computeTarget([session("2026-11-10", 60, [10, 10, 10])], scheme, 2.5, "2026-11-20");
  assert.equal(t.weightKg, 55);
  assert.equal(t.reason, "balik_libur_sebentar");
});

test("libur >= 14 hari: ±80% beban terakhir", () => {
  const t = computeTarget([session("2026-11-01", 60, [10, 10, 10])], scheme, 2.5, "2026-11-20");
  assert.equal(t.weightKg, 47.5);
  assert.equal(t.reason, "balik_libur_lama");
});

test("tepat 7 hari dihitung libur, 6 hari belum", () => {
  const seven = computeTarget([session("2026-11-10", 60, [10, 10, 10])], scheme, 2.5, "2026-11-17");
  const six = computeTarget([session("2026-11-10", 60, [10, 10, 10])], scheme, 2.5, "2026-11-16");
  assert.equal(seven.reason, "balik_libur_sebentar");
  assert.equal(six.reason, "naik_beban");
});

test("dumbbell langkah 2 kg: naik 20 -> 22, libur 20 -> 18", () => {
  const dbScheme: Scheme = { sets: 3, repMin: 8, repMax: 12 };
  const naik = computeTarget([session("2026-11-23", 20, [12, 12, 12])], dbScheme, 2, "2026-11-26");
  assert.equal(naik.weightKg, 22);
  const libur = computeTarget([session("2026-11-10", 20, [12, 12, 12])], dbScheme, 2, "2026-11-20");
  assert.equal(libur.weightKg, 18);
});

test("beban kecil: setelah libur tetap lebih ringan dan nggak jadi 0", () => {
  const t = computeTarget([session("2026-11-10", 2, [15, 15])], { sets: 2, repMin: 12, repMax: 15 }, 2, "2026-11-20");
  assert.ok(t.weightKg != null && t.weightKg > 0);
});

test("riwayat yang urutannya terbalik tetap dibaca benar", () => {
  const t = computeTarget(
    [session("2026-11-10", 50, [10, 10, 10]), session("2026-11-23", 60, [10, 9, 8])],
    scheme,
    2.5,
    "2026-11-26",
  );
  assert.equal(t.weightKg, 60);
  assert.equal(t.reps, 9);
});

test("helper tanggal dan pembulatan", () => {
  assert.equal(daysBetween("2026-11-28", "2026-12-05"), 7);
  assert.equal(daysBetween("2026-12-30", "2027-01-02"), 3);
  assert.equal(roundToStep(54, 2.5), 55);
  assert.equal(roundToStep(18, 2), 18);
});
