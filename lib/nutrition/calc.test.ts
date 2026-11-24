import { test } from "node:test";
import assert from "node:assert/strict";
import { clampFactor, labelFaktor, persen, scaleRange, sisa, sumItems } from "./calc.ts";

const nasi = { kcal: 260, proteinG: 5, carbsG: 57, fatG: 0.5 };
const ayam = { kcal: 280, proteinG: 26, carbsG: 0, fatG: 19 };

test("sumItems: jumlahkan semua item", () => {
  assert.deepEqual(sumItems([nasi, ayam]), { kcal: 540, proteinG: 31, carbsG: 57, fatG: 19.5 });
});

test("sumItems: pengali porsi ½, 1½, 2", () => {
  assert.equal(sumItems([nasi, ayam], 0.5).kcal, 270);
  assert.equal(sumItems([nasi, ayam], 1.5).proteinG, 46.5);
  assert.equal(sumItems([nasi, ayam], 2).kcal, 1080);
});

test("sumItems: kosong = 0, nggak NaN", () => {
  assert.deepEqual(sumItems([]), { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 });
});

test("clampFactor menolak nilai aneh", () => {
  assert.equal(clampFactor(NaN), 1);
  assert.equal(clampFactor(0), 0.25);
  assert.equal(clampFactor(99), 4);
  assert.equal(clampFactor(1.5), 1.5);
});

test("scaleRange ikut pengali, null tetap null", () => {
  assert.deepEqual(scaleRange(400, 600, 1.5), { min: 600, max: 900 });
  assert.deepEqual(scaleRange(null, null, 2), { min: null, max: null });
});

test("persen dan sisa terhadap target", () => {
  assert.equal(persen(1350, 2700), 50);
  assert.equal(persen(10, 0), 0);
  assert.equal(sisa(62, 135), 73);
  assert.equal(sisa(150, 135), 0);
});

test("label porsi", () => {
  assert.equal(labelFaktor(0.5), "½");
  assert.equal(labelFaktor(1), "1");
  assert.equal(labelFaktor(1.5), "1½");
  assert.equal(labelFaktor(2), "2");
});
