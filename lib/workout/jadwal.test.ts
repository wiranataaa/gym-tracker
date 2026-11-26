import { test } from "node:test";
import assert from "node:assert/strict";
import { hariLatihanBerikutnya, labelKapan } from "./jadwal.ts";

const KERJA = [1, 2, 3, 4, 5];

test("hariLatihanBerikutnya: Kamis -> Jumat, Jumat -> Senin (lewati weekend)", () => {
  assert.equal(hariLatihanBerikutnya("2026-11-26", KERJA), "2026-11-27");
  assert.equal(hariLatihanBerikutnya("2026-11-27", KERJA), "2026-11-30");
  assert.equal(hariLatihanBerikutnya("2026-11-28", KERJA), "2026-11-30");
});

test("hariLatihanBerikutnya: pengaturan kosong -> besok", () => {
  assert.equal(hariLatihanBerikutnya("2026-11-27", []), "2026-11-28");
});

test("labelKapan", () => {
  assert.equal(labelKapan("2026-11-26", "2026-11-27"), "Besok (Jumat)");
  assert.equal(labelKapan("2026-11-27", "2026-11-30"), "Senin, 30 Nov");
});
