import { test } from "node:test";
import assert from "node:assert/strict";
import { gerakanSekarang, hitungSet, teksDilewati, totalSet, ubahDilewati } from "./lewati.ts";

const MENU = [
  { exerciseId: 1, sets: 3 },
  { exerciseId: 2, sets: 3 },
  { exerciseId: 3, sets: 2 },
];

test("totalSet: set yang dilewati keluar dari rencana, yang sudah dikerjakan tetap dihitung", () => {
  assert.deepEqual(totalSet(MENU, hitungSet([1, 1]), []), { rencana: 8, beres: 2 });
  assert.deepEqual(totalSet(MENU, hitungSet([1, 1]), [1]), { rencana: 7, beres: 2 });
  assert.deepEqual(totalSet(MENU, hitungSet([1, 1]), [1, 2]), { rencana: 4, beres: 2 });
  assert.deepEqual(totalSet(MENU, hitungSet([1, 1, 1, 1]), []), { rencana: 8, beres: 3 }); // set ekstra nggak melebihi rencana
});

test("gerakanSekarang: gerakan set terakhir kalau belum beres", () => {
  assert.equal(gerakanSekarang(MENU, [1, 2], [])?.exerciseId, 2);
});

test("gerakanSekarang: kalau set terakhir sudah beres atau dilewati, pindah ke yang pertama belum beres", () => {
  assert.equal(gerakanSekarang(MENU, [2, 2, 2], [])?.exerciseId, 1);
  assert.equal(gerakanSekarang(MENU, [1, 1], [1])?.exerciseId, 2);
  assert.equal(gerakanSekarang(MENU, [], [])?.exerciseId, 1);
});

test("gerakanSekarang: semua beres -> kosong", () => {
  assert.equal(gerakanSekarang(MENU, [1, 1, 1, 3, 3], [2]), undefined);
});

test("ubahDilewati: tambah tanpa dobel, hapus", () => {
  assert.deepEqual(ubahDilewati([1], 1, true), [1]);
  assert.deepEqual(ubahDilewati([1], 2, true), [1, 2]);
  assert.deepEqual(ubahDilewati([1, 2], 1, false), [2]);
});

test("teksDilewati", () => {
  assert.equal(teksDilewati("Leg Press", 0, 2), "Leg Press: nggak dikerjakan");
  assert.equal(teksDilewati("Barbell Row", 2, 3), "Barbell Row: berhenti di 2 dari 3 set");
  assert.equal(teksDilewati("Barbell Row", 2, null), "Barbell Row: berhenti di 2 set");
});
