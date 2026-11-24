import { test } from "node:test";
import assert from "node:assert/strict";
import { deteksiDeload, setDeload, turunBerturut, type RiwayatE1rm } from "./deload.ts";

const dasar = { today: "2027-01-24", deloadTerakhir: null, sesiPertama: "2026-12-01", sesiSejakAcuan: 14, riwayat: [] as RiwayatE1rm[], sedangDeload: false };

test("turunBerturut: dua penurunan beruntun di tiga sesi terakhir", () => {
  assert.equal(turunBerturut([80, 82, 84]), false);
  assert.equal(turunBerturut([84, 82, 80]), true);
  assert.equal(turunBerturut([90, 84, 82, 80]), true);
  assert.equal(turunBerturut([84, 82, 83]), false); // naik lagi
  assert.equal(turunBerturut([84, 84, 80]), false); // sama bukan turun
  assert.equal(turunBerturut([84, 80]), false); // kurang data
});

test("berdasarkan waktu: >= 7 minggu dan cukup sesi -> disarankan", () => {
  const r = deteksiDeload(dasar); // 1 Des -> 24 Jan = 54 hari (7,7 minggu)
  assert.equal(r.perlu, true);
  assert.match(r.alasan[0], /7 minggu/);
});

test("belum 7 minggu, atau sesinya sedikit -> belum perlu", () => {
  assert.equal(deteksiDeload({ ...dasar, today: "2027-01-10" }).perlu, false);
  assert.equal(deteksiDeload({ ...dasar, sesiSejakAcuan: 6 }).perlu, false);
});

test("acuan pakai deload terakhir kalau lebih baru dari sesi pertama", () => {
  assert.equal(deteksiDeload({ ...dasar, deloadTerakhir: "2027-01-10" }).perlu, false);
});

test("berdasarkan performa: >= 3 gerakan turun 2 sesi berturut-turut (dan >= 40% dari yang dipantau)", () => {
  const turun = (nama: string): RiwayatE1rm => ({ nama, e1rm: [90, 86, 84] });
  const naik = (nama: string): RiwayatE1rm => ({ nama, e1rm: [80, 82, 84] });
  const r = deteksiDeload({ ...dasar, today: "2026-12-20", riwayat: [turun("Bench"), turun("Row"), turun("Squat"), naik("OHP"), naik("RDL")] });
  assert.equal(r.perlu, true);
  assert.match(r.alasan.join(" "), /Bench, Row, Squat/);

  const sedikit = deteksiDeload({ ...dasar, today: "2026-12-20", riwayat: [turun("Bench"), turun("Row"), naik("Squat"), naik("OHP")] });
  assert.equal(sedikit.perlu, false); // cuma 2 gerakan
});

test("sedang deload -> nggak disarankan lagi", () => {
  assert.equal(deteksiDeload({ ...dasar, sedangDeload: true }).perlu, false);
});

test("setDeload: ±60%, minimal 2 set", () => {
  assert.equal(setDeload(3), 2);
  assert.equal(setDeload(4), 2);
  assert.equal(setDeload(5), 3);
  assert.equal(setDeload(2), 2);
  assert.equal(setDeload(1), 1);
});
