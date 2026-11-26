import { test } from "node:test";
import assert from "node:assert/strict";
import { bacaDaftarGanti, batalGanti, calonPengganti, tambahGanti, terapkanGanti, type GerakanCalon, type ItemMenu } from "./ganti.ts";

const g = (id: number, name: string, muscle_group: string, kind: string, equipment: string): GerakanCalon => ({ id, name, muscle_group, kind, equipment });
const SEMUA = [
  g(1, "Incline Dumbbell Press", "Dada", "compound", "Dumbbell + bench"),
  g(2, "Barbell Bench Press", "Dada", "compound", "Barbell + bench"),
  g(3, "Cable Fly", "Dada", "isolation", "Cable machine"),
  g(4, "Smith Machine Incline Press", "Dada", "compound", "Smith machine"),
  g(5, "Dumbbell Bench Press", "Dada", "compound", "Dumbbell + bench"),
  g(6, "Seated Cable Row", "Punggung", "compound", "Cable machine"),
  g(7, "Smith Machine Squat", "Kaki", "compound", "Smith machine"),
  g(8, "Leg Press", "Kaki", "compound", "Leg press"),
  g(9, "Barbell Romanian Deadlift", "Hamstring & glutes", "compound", "Barbell"),
  g(10, "Cable Face Pull", "Bahu belakang", "isolation", "Cable machine"),
  g(11, "Cable Lateral Raise", "Bahu", "isolation", "Cable machine"),
];

test("calonPengganti: otot sama, compound dulu, alat beda didahulukan dari alat yang penuh", () => {
  const c = calonPengganti(SEMUA[0], SEMUA, [1, 6, 7]).map((x) => x.id);
  assert.deepEqual(c, [2, 4, 5, 3]); // barbell & smith (alat beda), lalu dumbbell, lalu fly (isolation)
});

test("calonPengganti: yang sudah ada di menu nggak ditawarkan; kelompok lain nggak ikut", () => {
  const c = calonPengganti(SEMUA[0], SEMUA, [1, 2]).map((x) => x.id);
  assert.ok(!c.includes(2));
  assert.ok(!c.includes(6));
});

test("calonPengganti: kelompok terkait dipakai setelah kelompok yang sama", () => {
  const c = calonPengganti(SEMUA[6], SEMUA, [7]).map((x) => x.id);
  assert.deepEqual(c, [8, 9]); // leg press (Kaki) dulu, baru RDL (terkait)
  assert.deepEqual(calonPengganti(SEMUA[9], SEMUA, [10]).map((x) => x.id), [11]); // bahu belakang -> bahu
});

test("calonPengganti: kalau setara, dumbbell ditaruh belakangan (areanya sering penuh)", () => {
  const semua = [...SEMUA, g(12, "Dumbbell Walking Lunge", "Kaki", "compound", "Dumbbell")];
  assert.deepEqual(calonPengganti(semua[6], semua, [7]).map((x) => x.id), [8, 12, 9]); // leg press di atas lunge
});

test("calonPengganti: dibatasi jumlahnya", () => {
  assert.equal(calonPengganti(SEMUA[0], SEMUA, [1], 2).length, 2);
});

type Item = ItemMenu & { nama?: string };
const MENU: Item[] = [
  { exerciseId: 1, sets: 3, gantiDari: null },
  { exerciseId: 6, sets: 3, gantiDari: null },
];
const buat = (asal: Item, ke: number, sets: number): Item => ({ exerciseId: ke, sets, gantiDari: asal.exerciseId });
const ringkas = (m: Item[]) => m.map((x) => [x.exerciseId, x.sets, x.gantiDari]);

test("terapkanGanti: belum ada set -> diganti di tempat dengan jumlah set sama", () => {
  assert.deepEqual(ringkas(terapkanGanti(MENU, [{ dari: 1, ke: 2 }], new Map(), buat)), [[2, 3, 1], [6, 3, null]]);
});

test("terapkanGanti: sudah ada set -> asal tetap dengan set yang dikerjakan, pengganti dapat sisanya", () => {
  assert.deepEqual(ringkas(terapkanGanti(MENU, [{ dari: 1, ke: 2 }], new Map([[1, 1]]), buat)), [[1, 1, null], [2, 2, 1], [6, 3, null]]);
});

test("terapkanGanti: diabaikan kalau set sudah penuh, pengganti sudah di menu, atau gerakan nggak ketemu", () => {
  assert.deepEqual(ringkas(terapkanGanti(MENU, [{ dari: 1, ke: 2 }], new Map([[1, 3]]), buat)), ringkas(MENU));
  assert.deepEqual(ringkas(terapkanGanti(MENU, [{ dari: 1, ke: 6 }], new Map(), buat)), ringkas(MENU));
  assert.deepEqual(ringkas(terapkanGanti(MENU, [{ dari: 99, ke: 2 }], new Map(), buat)), ringkas(MENU));
  assert.deepEqual(ringkas(terapkanGanti(MENU, [{ dari: 1, ke: 2 }], new Map(), () => null)), ringkas(MENU));
});

test("terapkanGanti: berantai kalau pengganti sudah ada set lalu diganti lagi", () => {
  const m = terapkanGanti(MENU, [{ dari: 1, ke: 2 }, { dari: 2, ke: 4 }], new Map([[2, 1]]), buat);
  assert.deepEqual(ringkas(m), [[2, 1, 1], [4, 2, 2], [6, 3, null]]);
});

test("tambahGanti: A->B lalu B->C (B belum ada set) jadi A->C; balik ke A menghapus", () => {
  const satu = tambahGanti([], 1, 2, 0);
  assert.deepEqual(tambahGanti(satu, 2, 4, 0), [{ dari: 1, ke: 4 }]);
  assert.deepEqual(tambahGanti(satu, 2, 1, 0), []);
});

test("tambahGanti: kalau B sudah ada set, B->C jadi catatan baru", () => {
  assert.deepEqual(tambahGanti([{ dari: 1, ke: 2 }], 2, 4, 1), [{ dari: 1, ke: 2 }, { dari: 2, ke: 4 }]);
});

test("batalGanti dan bacaDaftarGanti", () => {
  assert.deepEqual(batalGanti([{ dari: 1, ke: 2 }, { dari: 6, ke: 3 }], 2), [{ dari: 6, ke: 3 }]);
  assert.deepEqual(bacaDaftarGanti([{ dari: 1, ke: 2 }, { dari: "x" }, null]), [{ dari: 1, ke: 2 }]);
  assert.deepEqual(bacaDaftarGanti("bukan array"), []);
});
