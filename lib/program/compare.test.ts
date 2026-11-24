import { test } from "node:test";
import assert from "node:assert/strict";
import { bandingkan, setTerbaik } from "./compare.ts";

test("setTerbaik: beban tertinggi, lalu reps terbanyak di beban itu", () => {
  assert.deepEqual(setTerbaik([{ weightKg: 60, reps: 10 }, { weightKg: 62, reps: 6 }, { weightKg: 62, reps: 7 }]), { weightKg: 62, reps: 7 });
});

test("bandingkan: semua kemungkinan", () => {
  const prev = { weightKg: 60, reps: 10 };
  assert.equal(bandingkan(null, prev), "pertama");
  assert.equal(bandingkan(prev, { weightKg: 62, reps: 6 }), "beban_naik");
  assert.equal(bandingkan(prev, { weightKg: 60, reps: 11 }), "rep_naik");
  assert.equal(bandingkan(prev, { weightKg: 60, reps: 10 }), "sama");
  assert.equal(bandingkan(prev, { weightKg: 60, reps: 8 }), "rep_turun");
  assert.equal(bandingkan(prev, { weightKg: 58, reps: 12 }), "lebih_ringan");
});
