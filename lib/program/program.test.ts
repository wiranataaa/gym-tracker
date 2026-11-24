import { test } from "node:test";
import assert from "node:assert/strict";
import { nextProgramDay, pilihHariIni, sesiUtamaMingguIni } from "./queue.ts";
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

// ---------- Hari utama vs bonus (variasi kalau latihan tiap hari) ----------
const daysAll: ProgramDay[] = [
  { id: 11, position: 1, name: "Full Body A", kind: "utama" },
  { id: 12, position: 2, name: "Full Body B", kind: "utama" },
  { id: 13, position: 3, name: "Full Body C", kind: "utama" },
  { id: 21, position: 1, name: "Bonus D", kind: "bonus" },
  { id: 22, position: 2, name: "Bonus E", kind: "bonus" },
  { id: 23, position: 3, name: "Bonus F", kind: "bonus" },
];
const selesai = (programDayId: number, date: string): SessionLite => ({ programDayId, status: "selesai", startedAt: `${date}T05:00:00Z`, date });

test("variasi: tiga sesi utama dulu (A, B, C), setelah itu bonus D, E, F", () => {
  const pilih = (sesi: SessionLite[], hari: string) => pilihHariIni(daysAll, sesi, hari)?.day.name;
  assert.equal(pilih([], "2026-11-30"), "Full Body A");
  assert.equal(pilih([selesai(11, "2026-11-30")], "2026-12-01"), "Full Body B");
  assert.equal(pilih([selesai(11, "2026-11-30"), selesai(12, "2026-12-01")], "2026-12-02"), "Full Body C");
  const tigaUtama = [selesai(11, "2026-11-30"), selesai(12, "2026-12-01"), selesai(13, "2026-12-02")];
  assert.equal(pilih(tigaUtama, "2026-12-03"), "Bonus D");
  assert.equal(pilih([...tigaUtama, selesai(21, "2026-12-03")], "2026-12-04"), "Bonus E");
  assert.equal(pilih([...tigaUtama, selesai(21, "2026-12-03"), selesai(22, "2026-12-04")], "2026-12-05"), "Bonus F");
});

test("variasi: minggu baru mulai lagi dari jalur utama, dan lanjut urutan (D berikutnya = lanjut, bukan ulang)", () => {
  const minggu1 = [selesai(11, "2026-11-30"), selesai(12, "2026-12-01"), selesai(13, "2026-12-02"), selesai(21, "2026-12-03")];
  const r = pilihHariIni(daysAll, minggu1, "2026-12-07"); // Senin minggu berikutnya
  assert.equal(r?.day.name, "Full Body A");
  assert.equal(r?.jenis, "utama");
});

test("variasi: sesi bonus nggak menggeser antrean utama, dan sebaliknya", () => {
  const sesi = [selesai(11, "2026-11-30"), selesai(12, "2026-12-01"), selesai(13, "2026-12-02"), selesai(21, "2026-12-03")];
  assert.equal(nextProgramDay(daysAll, sesi, "utama")?.name, "Full Body A");
  assert.equal(nextProgramDay(daysAll, sesi, "bonus")?.name, "Bonus E");
});

test("variasi: sesi skip atau berjalan nggak dihitung ke jatah utama minggu itu", () => {
  const sesi: SessionLite[] = [
    selesai(11, "2026-11-30"),
    selesai(12, "2026-12-01"),
    { programDayId: 13, status: "dilewati", startedAt: "2026-12-02T05:00:00Z", date: "2026-12-02" },
    { programDayId: 13, status: "berjalan", startedAt: "2026-12-02T06:00:00Z", date: "2026-12-02" },
  ];
  assert.equal(sesiUtamaMingguIni(daysAll, sesi, "2026-12-03"), 2);
  assert.equal(pilihHariIni(daysAll, sesi, "2026-12-03")?.day.name, "Full Body C");
});

test("variasi: tanpa hari bonus tetap lanjut jalur utama; tanpa program -> null", () => {
  const cuma = daysAll.filter((d) => d.kind === "utama");
  const tiga = [selesai(11, "2026-11-30"), selesai(12, "2026-12-01"), selesai(13, "2026-12-02")];
  assert.equal(pilihHariIni(cuma, tiga, "2026-12-03")?.day.name, "Full Body A");
  assert.equal(pilihHariIni([], [], "2026-12-03"), null);
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
