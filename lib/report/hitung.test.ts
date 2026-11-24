import { test } from "node:test";
import assert from "node:assert/strict";
import { awalMinggu, geser, sesiPerMinggu, sesuaikanKalori, skorKonsistensi, stagnan, streakMinggu } from "./hitung.ts";

test("awalMinggu: Senin dari minggu yang memuat tanggal itu", () => {
  assert.equal(awalMinggu("2026-12-06"), "2026-11-30"); // Minggu -> Senin 30 Nov
  assert.equal(awalMinggu("2026-11-30"), "2026-11-30"); // Senin
  assert.equal(awalMinggu("2026-12-02"), "2026-11-30"); // Rabu
  assert.equal(awalMinggu("2027-01-01"), "2026-12-28"); // lintas tahun
});

test("geser tanggal", () => {
  assert.equal(geser("2026-12-30", 3), "2027-01-02");
  assert.equal(geser("2026-03-01", -1), "2026-02-28");
});

test("skorKonsistensi: dibatasi 100%", () => {
  assert.equal(skorKonsistensi(2, 3), 67);
  assert.equal(skorKonsistensi(3, 3), 100);
  assert.equal(skorKonsistensi(5, 3), 100);
  assert.equal(skorKonsistensi(0, 3), 0);
  assert.equal(skorKonsistensi(2, 0), 0);
});

test("sesiPerMinggu dan streak", () => {
  const tgl = ["2026-11-02", "2026-11-04", "2026-11-06", "2026-11-09", "2026-11-11", "2026-11-13", "2026-11-16", "2026-11-18"];
  const m = sesiPerMinggu(tgl);
  assert.equal(m.get("2026-11-02"), 3);
  assert.equal(m.get("2026-11-16"), 2);
  assert.equal(streakMinggu(m, "2026-11-09", 3), 2); // minggu 9 Nov dan 2 Nov
  assert.equal(streakMinggu(m, "2026-11-16", 3), 0); // minggu terakhir cuma 2 sesi
  assert.equal(streakMinggu(new Map(), "2026-11-16", 3), 0);
});

test("sesuaikanKalori: naik terlalu cepat -> turun 150", () => {
  const r = sesuaikanKalori({ kcalSekarang: 2700, lajuMingguIni: 0.7, lajuMingguLalu: 0.4, ramadan: false });
  assert.equal(r.kcalBaru, 2550);
  assert.equal(r.berubah, true);
});

test("sesuaikanKalori: lambat 2 minggu berturut-turut -> naik 150", () => {
  const r = sesuaikanKalori({ kcalSekarang: 2700, lajuMingguIni: 0.1, lajuMingguLalu: 0.0, ramadan: false });
  assert.equal(r.kcalBaru, 2850);
  assert.equal(r.berubah, true);
});

test("sesuaikanKalori: lambat cuma 1 minggu -> belum diubah", () => {
  const r = sesuaikanKalori({ kcalSekarang: 2700, lajuMingguIni: 0.1, lajuMingguLalu: 0.35, ramadan: false });
  assert.equal(r.kcalBaru, 2700);
  assert.equal(r.berubah, false);
});

test("sesuaikanKalori: di rentang 0,2-0,5 -> tetap; tepat 0,5 tetap, 0,2 tetap", () => {
  for (const laju of [0.2, 0.35, 0.5]) {
    assert.equal(sesuaikanKalori({ kcalSekarang: 2700, lajuMingguIni: laju, lajuMingguLalu: 0.1, ramadan: false }).berubah, false);
  }
});

test("sesuaikanKalori: data kurang, Ramadan, dan batas aman", () => {
  assert.equal(sesuaikanKalori({ kcalSekarang: 2700, lajuMingguIni: null, lajuMingguLalu: null, ramadan: false }).berubah, false);
  assert.equal(sesuaikanKalori({ kcalSekarang: 2700, lajuMingguIni: 0.9, lajuMingguLalu: 0.9, ramadan: true }).berubah, false);
  assert.equal(sesuaikanKalori({ kcalSekarang: 2000, lajuMingguIni: 0.9, lajuMingguLalu: 0.9, ramadan: false }).berubah, false);
  assert.equal(sesuaikanKalori({ kcalSekarang: 3600, lajuMingguIni: 0, lajuMingguLalu: 0, ramadan: false }).berubah, false);
});

test("stagnan: butuh >= 4 sesi dan 3 terakhir nggak melampaui rekor sebelumnya", () => {
  assert.equal(stagnan([80, 82, 84]), false); // terlalu sedikit
  assert.equal(stagnan([80, 85, 84, 84, 83]), true);
  assert.equal(stagnan([80, 82, 84, 86, 85]), false); // 86 > semua sebelum 3 terakhir (82? 80,82)
  assert.equal(stagnan([80, 82, 84, 84, 84, 84]), true);
});
