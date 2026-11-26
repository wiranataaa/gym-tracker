import { test } from "node:test";
import assert from "node:assert/strict";
import { rekomendasiKardio } from "./kardio.ts";

test("kardio dasar 20 menit kalau laju berat normal atau belum ada data", () => {
  assert.equal(rekomendasiKardio({ mode: "normal", lajuBeratKg: null }).menit, 20);
  assert.equal(rekomendasiKardio({ mode: "normal", lajuBeratKg: 0.35 }).menit, 20);
});

test("berat naik cepat: hari beban tetap mentok 20 menit (muat 1 jam) dengan saran jalan kaki; hari recovery ditambah", () => {
  const k = rekomendasiKardio({ mode: "normal", lajuBeratKg: 0.7 });
  assert.equal(k.menit, 20);
  assert.match(k.alasan, /jalan kaki/);
  assert.equal(rekomendasiKardio({ mode: "normal", recovery: true, lajuBeratKg: 0.7 }).menit, 45);
});

test("berat naik lambat -> kardio dikurangi (tapi nggak di bawah 10)", () => {
  assert.equal(rekomendasiKardio({ mode: "normal", lajuBeratKg: 0.1 }).menit, 15);
});

test("versi singkat -> 10 menit, Ramadan -> maksimal 15", () => {
  assert.equal(rekomendasiKardio({ mode: "singkat", lajuBeratKg: 0.7 }).menit, 10);
  assert.equal(rekomendasiKardio({ mode: "normal", lajuBeratKg: 0.7, ramadan: true }).menit, 15);
});

test("hari recovery -> 35 menit, versi singkat nggak memotongnya", () => {
  assert.equal(rekomendasiKardio({ mode: "normal", recovery: true, lajuBeratKg: null }).menit, 35);
  assert.equal(rekomendasiKardio({ mode: "singkat", recovery: true, lajuBeratKg: null }).menit, 35);
});

test("selalu kelipatan 5 dan di dalam batas", () => {
  for (const laju of [null, -0.2, 0, 0.1, 0.3, 0.6, 1.5]) {
    for (const mode of ["normal", "singkat"] as const) {
      for (const recovery of [false, true]) {
        const m = rekomendasiKardio({ mode, recovery, lajuBeratKg: laju }).menit;
        assert.equal(m % 5, 0);
        assert.ok(m >= 10 && m <= 45);
      }
    }
  }
});

test("deskripsi menyebut menit, incline, dan kecepatan", () => {
  const k = rekomendasiKardio({ mode: "normal", lajuBeratKg: null });
  assert.match(k.deskripsi, /20 menit/);
  assert.match(k.deskripsi, /incline/);
  assert.match(k.deskripsi, /km\/jam/);
});
