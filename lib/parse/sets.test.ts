import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSetText, resolveExercise } from "./sets.ts";
import type { ExerciseRef } from "./sets.ts";

function ok(input: string) {
  const r = parseSetText(input);
  assert.equal(r.ok, true, `harusnya terbaca: "${input}"`);
  if (!r.ok) throw new Error("unreachable");
  return r;
}

test("bench 60x10 -> 1 set", () => {
  const r = ok("bench 60x10");
  assert.equal(r.exerciseQuery, "bench");
  assert.equal(r.weightKg, 60);
  assert.deepEqual(r.reps, [10]);
});

test("bench 60x10x3 -> 3 set sama", () => {
  assert.deepEqual(ok("bench 60x10x3").reps, [10, 10, 10]);
});

test("bench 60 10,10,9 -> 3 set beda", () => {
  const r = ok("bench 60 10,10,9");
  assert.equal(r.weightKg, 60);
  assert.deepEqual(r.reps, [10, 10, 9]);
});

test("squat 80 8 8 7 rpe8 -> 3 set + RPE", () => {
  const r = ok("squat 80 8 8 7 rpe8");
  assert.equal(r.weightKg, 80);
  assert.deepEqual(r.reps, [8, 8, 7]);
  assert.equal(r.rpe, 8);
});

test("desimal pakai koma atau titik", () => {
  assert.equal(ok("bench 57,5x10").weightKg, 57.5);
  assert.equal(ok("bench 57.5x10").weightKg, 57.5);
  assert.equal(ok("bench 57,5 10,9").weightKg, 57.5);
});

test("nama gerakan lebih dari satu kata, kapital, spasi, 'kg'", () => {
  const r = ok("  Lat Pulldown 45 kg x 12 x 3 ");
  assert.equal(r.exerciseQuery, "lat pulldown");
  assert.equal(r.weightKg, 45);
  assert.deepEqual(r.reps, [12, 12, 12]);
});

test("simbol × dan spasi di sekitar x", () => {
  assert.deepEqual(ok("bench 60 x 10 x 2").reps, [10, 10]);
  assert.deepEqual(ok("bench 60×8").reps, [8]);
});

test("warmup ditandai", () => {
  const r = ok("bench 40x10 warmup");
  assert.equal(r.isWarmup, true);
  assert.equal(r.exerciseQuery, "bench");
});

test("format nggak dikenali -> ok:false (nanti diparsing AI)", () => {
  for (const bad of ["", "halo", "bench", "bench enam puluh", "tadi bench 60 kilo 10 kali 3 set", "bench 60"]) {
    assert.equal(parseSetText(bad).ok, false, `harusnya gagal: "${bad}"`);
  }
});

test("angka nggak masuk akal ditolak", () => {
  assert.equal(parseSetText("bench 600x10").ok, false);
  assert.equal(parseSetText("bench 60x0").ok, false);
  assert.equal(parseSetText("bench 60x500").ok, false);
  assert.equal(parseSetText("bench 60x10x50").ok, false);
  assert.equal(parseSetText("bench 60x10 rpe11").ok, false);
});

// ---------- Cocokkan gerakan ----------
const exercises: ExerciseRef[] = [
  { id: 1, name: "Barbell Back Squat", aliases: ["squat", "sq", "back squat"] },
  { id: 2, name: "Bench Press", aliases: ["bench", "bp", "bench press"] },
  { id: 3, name: "Barbell Row", aliases: ["row", "brow", "barbell row"] },
  { id: 4, name: "Overhead Press", aliases: ["ohp", "press", "overhead press"] },
  { id: 5, name: "Seated Cable Row", aliases: ["cable row", "seated row"] },
  { id: 6, name: "Lat Pulldown", aliases: ["pulldown", "lat pulldown", "lat"] },
  { id: 7, name: "Dumbbell Lateral Raise", aliases: ["lateral raise", "side raise"] },
  { id: 8, name: "Smith Machine Squat", aliases: ["smith squat", "smith"] },
];

function id(query: string) {
  const r = resolveExercise(query, exercises);
  return r.kind === "found" ? r.exercise.id : r.kind;
}

test("resolve: alias dan nama resmi", () => {
  assert.equal(id("bench"), 2);
  assert.equal(id("BP"), 2);
  assert.equal(id("squat"), 1);
  assert.equal(id("row"), 3);
  assert.equal(id("cable row"), 5);
  assert.equal(id("ohp"), 4);
  assert.equal(id("lat"), 6);
  assert.equal(id("Lat Pulldown"), 6);
});

test("resolve: awalan kata (lateral -> lateral raise)", () => {
  assert.equal(id("lateral"), 7);
  assert.equal(id("pull"), 6);
});

test("resolve: nggak ketemu -> none", () => {
  assert.equal(id("deadlift"), "none");
  assert.equal(id(""), "none");
});

test("resolve: ambigu kalau beberapa cocok sama kuat", () => {
  const r = resolveExercise("row", [
    { id: 1, name: "Cable Row", aliases: [] },
    { id: 2, name: "Dumbbell Row", aliases: [] },
  ]);
  assert.equal(r.kind, "ambiguous");
});
