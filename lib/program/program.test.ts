import { test } from "node:test";
import assert from "node:assert/strict";
import { nextProgramDay } from "./queue.ts";
import type { ProgramDay, SessionLite } from "./queue.ts";
import { shortModeExercises } from "./shortMode.ts";
import { detectPR, estimate1RM } from "./pr.ts";

const days: ProgramDay[] = [
  { id: 11, position: 1, name: "Full Body A" },
  { id: 12, position: 2, name: "Full Body B" },
  { id: 13, position: 3, name: "Full Body C" },
];
const done = (programDayId: number, startedAt: string): SessionLite => ({ programDayId, status: "selesai", startedAt });

// ---------- Antrean ----------
test("antrean: belum pernah latihan -> hari pertama", () => {
  assert.equal(nextProgramDay(days, [])?.name, "Full Body A");
});

test("antrean: A -> B -> C -> balik ke A", () => {
  assert.equal(nextProgramDay(days, [done(11, "2026-11-23T05:00:00Z")])?.name, "Full Body B");
  assert.equal(nextProgramDay(days, [done(12, "2026-11-24T05:00:00Z"), done(11, "2026-11-23T05:00:00Z")])?.name, "Full Body C");
  assert.equal(nextProgramDay(days, [done(13, "2026-11-25T05:00:00Z"), done(12, "2026-11-24T05:00:00Z")])?.name, "Full Body A");
});

test("antrean: skip dan sesi yang belum selesai nggak majuin antrean", () => {
  const sessions: SessionLite[] = [
    done(11, "2026-11-23T05:00:00Z"),
    { programDayId: 12, status: "dilewati", startedAt: "2026-11-24T05:00:00Z" },
    { programDayId: 12, status: "berjalan", startedAt: "2026-11-25T05:00:00Z" },
  ];
  assert.equal(nextProgramDay(days, sessions)?.name, "Full Body B");
});

test("antrean: bolos seminggu tetap lanjut dari urutan terakhir", () => {
  assert.equal(nextProgramDay(days, [done(12, "2026-11-10T05:00:00Z")])?.name, "Full Body C");
});

test("antrean: program kosong -> null", () => {
  assert.equal(nextProgramDay([], []), null);
});

// ---------- Mode singkat ----------
test("mode singkat: ambil gerakan inti saja, maksimal 3", () => {
  const items = [
    { name: "Squat", position: 1, isCore: true },
    { name: "Bench", position: 2, isCore: true },
    { name: "Row", position: 3, isCore: true },
    { name: "Lateral", position: 4, isCore: false },
    { name: "Pushdown", position: 5, isCore: false },
  ];
  assert.deepEqual(shortModeExercises(items).map((i) => i.name), ["Squat", "Bench", "Row"]);
});

test("mode singkat: kalau gerakan inti < 2, ambil 3 gerakan pertama", () => {
  const items = [
    { name: "A", position: 2, isCore: false },
    { name: "B", position: 1, isCore: true },
    { name: "C", position: 3, isCore: false },
    { name: "D", position: 4, isCore: false },
  ];
  assert.deepEqual(shortModeExercises(items).map((i) => i.name), ["B", "A", "C"]);
});

// ---------- PR ----------
test("Epley 1RM", () => {
  assert.equal(estimate1RM(100, 1), 100);
  assert.equal(estimate1RM(100, 5), 116.7);
  assert.equal(estimate1RM(60, 10), 80);
});

test("PR: set pertama sepanjang masa bukan PR", () => {
  const r = detectPR({ weightKg: 60, reps: 10 }, []);
  assert.equal(r.e1rm, false);
  assert.equal(r.reps, false);
});

test("PR: estimasi 1RM naik", () => {
  const r = detectPR({ weightKg: 62.5, reps: 8 }, [{ weightKg: 60, reps: 8 }, { weightKg: 60, reps: 9 }]);
  assert.equal(r.e1rm, true);
  assert.equal(r.reps, false); // belum pernah di 62,5 kg
});

test("PR: reps terbanyak di beban yang sama", () => {
  const r = detectPR({ weightKg: 60, reps: 11 }, [{ weightKg: 60, reps: 10 }, { weightKg: 65, reps: 5 }]);
  assert.equal(r.reps, true);
});

test("PR: sama dengan rekor sebelumnya bukan PR", () => {
  const r = detectPR({ weightKg: 60, reps: 10 }, [{ weightKg: 60, reps: 10 }]);
  assert.equal(r.e1rm, false);
  assert.equal(r.reps, false);
});
