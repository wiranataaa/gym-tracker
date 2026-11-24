import { test } from "node:test";
import assert from "node:assert/strict";
import { angkaDiData, angkaTidakDikenal, ekstrakAngka } from "./validasi.ts";

test("ekstrakAngka: format Indonesia (ribuan titik, desimal koma)", () => {
  assert.deepEqual(ekstrakAngka("volume 5.340 kg, bench 62,5 kg x 6"), [5340, 62.5, 6]);
  assert.deepEqual(ekstrakAngka("1.330 / 2.700 kcal"), [1330, 2700]);
  assert.deepEqual(ekstrakAngka("RPE 8 dan 3 set"), [8, 3]);
});

test("angkaDiData: kumpulkan angka dari objek bersarang dan string", () => {
  const a = angkaDiData({ a: 60, b: { c: [10, 12.5] }, d: "naik 2,5 kg", e: true });
  assert.deepEqual(a.sort((x, y) => x - y), [2.5, 10, 12.5, 60]);
});

test("angka yang ada di data lolos, termasuk selisih pembulatan kecil", () => {
  const data = { bench: { kg: 62, reps: 8 }, volume: 5340 };
  assert.deepEqual(angkaTidakDikenal("Bench 62 kg x 8, volume 5.340 kg", data), []);
});

test("angka karangan ketahuan", () => {
  const data = { bench: { kg: 62, reps: 8 }, volume: 5340 };
  assert.deepEqual(angkaTidakDikenal("Bench naik ke 70 kg, volume 6.000 kg", data), [70, 6000]);
});

test("angka kecil (< 10, bulat) dibebaskan, tapi desimal tidak", () => {
  const data = { kg: 62 };
  assert.deepEqual(angkaTidakDikenal("Ada 2 hal dan 3 poin, energi 4", data), []);
  assert.deepEqual(angkaTidakDikenal("naik 2,5 kg", data), [2.5]);
});

test("angka turunan boleh lewat parameter tambahan", () => {
  assert.deepEqual(angkaTidakDikenal("naik 12 kg dari sesi lalu", { a: 60, b: 72 }, [12]), []);
});
