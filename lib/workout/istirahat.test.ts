import assert from "node:assert/strict";
import { test } from "node:test";
import { fmtMenitDetik, geserTotal, istirahatDetik, sisaDetik } from "./istirahat.ts";

test("compound lebih lama dari isolation", () => {
  assert.equal(istirahatDetik({ jenis: "compound" }), 120);
  assert.equal(istirahatDetik({ jenis: "isolation" }), 75);
});

test("set mentok (RPE 9-10) dapat istirahat lebih lama; RPE di bawah 9 normal", () => {
  assert.equal(istirahatDetik({ jenis: "compound", rpe: 9 }), 180);
  assert.equal(istirahatDetik({ jenis: "compound", rpe: 10 }), 180);
  assert.equal(istirahatDetik({ jenis: "compound", rpe: 8 }), 120);
  assert.equal(istirahatDetik({ jenis: "isolation", rpe: 10 }), 105);
});

test("pemanasan singkat, apa pun jenisnya", () => {
  assert.equal(istirahatDetik({ jenis: "compound", pemanasan: true, rpe: 10 }), 45);
});

test("versi singkat lebih pendek di semua kondisi", () => {
  for (const jenis of ["compound", "isolation"] as const) {
    for (const rpe of [null, 7, 9]) {
      assert.ok(istirahatDetik({ jenis, rpe, singkat: true }) < istirahatDetik({ jenis, rpe }));
    }
  }
});

test("sisaDetik membulat ke atas dan nggak negatif", () => {
  assert.equal(sisaDetik(10_000, 9_001), 1);
  assert.equal(sisaDetik(10_000, 10_000), 0);
  assert.equal(sisaDetik(10_000, 12_000), 0);
  assert.equal(sisaDetik(100_000, 0), 100);
});

test("fmtMenitDetik", () => {
  assert.equal(fmtMenitDetik(125), "2:05");
  assert.equal(fmtMenitDetik(60), "1:00");
  assert.equal(fmtMenitDetik(9), "0:09");
  assert.equal(fmtMenitDetik(-3), "0:00");
});

test("geserTotal dibatasi 15 detik sampai 10 menit", () => {
  assert.equal(geserTotal(120, 15), 135);
  assert.equal(geserTotal(20, -15), 15);
  assert.equal(geserTotal(595, 15), 600);
});
