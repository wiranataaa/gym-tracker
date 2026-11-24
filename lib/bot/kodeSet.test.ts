import { test } from "node:test";
import assert from "node:assert/strict";
import { bacaKodeSet, kodeSet, type SetKode } from "./kodeSet.ts";

test("kode dan baca balik menghasilkan data yang sama", () => {
  const s: SetKode = { exerciseId: 12, bebanKg: 62.5, reps: [10, 10, 9], rpe: 8, pemanasan: false };
  assert.equal(kodeSet(s), "ft:12:62.5:10-10-9:8:0");
  assert.deepEqual(bacaKodeSet(kodeSet(s)), s);
});

test("tanpa RPE dan pemanasan", () => {
  const s: SetKode = { exerciseId: 3, bebanKg: 0, reps: [12], rpe: null, pemanasan: true };
  assert.deepEqual(bacaKodeSet(kodeSet(s)), s);
});

test("kode terpanjang tetap di bawah batas 64 byte Telegram", () => {
  const s: SetKode = { exerciseId: 999999, bebanKg: 499.5, reps: Array(10).fill(100), rpe: 10, pemanasan: true };
  assert.ok(Buffer.byteLength(kodeSet(s)) <= 64, `${Buffer.byteLength(kodeSet(s))} byte`);
});

test("kode rusak atau berbahaya ditolak", () => {
  for (const x of ["ft:1:60:10-10:8", "ft:a:60:10:0:0", "ft:1:600:10:0:0", "ft:1:60:0:0:0", "ft:1:60:10-101:0:0", "ft:1:60:10:11:0", "xx:1:60:10:0:0", "ft:1:60:" + "1-".repeat(11) + "1:0:0"]) {
    assert.equal(bacaKodeSet(x), null, x);
  }
});
