import { test } from "node:test";
import assert from "node:assert/strict";
import { bandingkan, hariSejakFoto, kelompokkan, pengingatFoto, sudutValid, type FotoBaris } from "./hitung.ts";

const f = (id: number, tanggal: string, sudut: FotoBaris["sudut"], beratKg: number | null = null): FotoBaris => ({ id, tanggal, sudut, path: `progres/${id}.jpg`, beratKg });

test("kelompokkan: per tanggal, terbaru dulu, berat diambil dari foto yang punya angka", () => {
  const g = kelompokkan([f(1, "2026-11-27", "depan"), f(2, "2026-11-27", "samping", 71.4), f(3, "2026-12-25", "depan", 73.0)]);
  assert.deepEqual(g.map((x) => x.tanggal), ["2026-12-25", "2026-11-27"]);
  assert.equal(g[1].beratKg, 71.4);
  assert.equal(g[1].foto.samping?.id, 2);
  assert.equal(g[1].foto.belakang, undefined);
});

test("bandingkan: terlama vs terbaru per sudut, dengan selisih hari dan berat", () => {
  const g = kelompokkan([f(1, "2026-11-27", "depan", 71.4), f(2, "2026-12-25", "depan", 72.6), f(3, "2027-01-22", "depan", 73.5)]);
  const b = bandingkan(g, "depan")!;
  assert.equal(b.awal.tanggal, "2026-11-27");
  assert.equal(b.terbaru.tanggal, "2027-01-22");
  assert.equal(b.hari, 56);
  assert.equal(b.selisihKg, 2.1);
});

test("bandingkan: butuh minimal dua tanggal untuk sudut itu; selisih berat kosong kalau salah satu tanpa angka", () => {
  const g = kelompokkan([f(1, "2026-11-27", "depan", 71.4), f(2, "2026-12-25", "samping")]);
  assert.equal(bandingkan(g, "depan"), null);
  assert.equal(bandingkan(g, "belakang"), null);
  const h = kelompokkan([f(1, "2026-11-27", "depan"), f(2, "2026-12-25", "depan", 72)]);
  assert.equal(bandingkan(h, "depan")!.selisihKg, null);
});

test("hariSejakFoto", () => {
  assert.equal(hariSejakFoto("2026-12-25", "2026-11-27"), 28);
  assert.equal(hariSejakFoto("2026-12-25", null), null);
});

test("pengingatFoto: belum pernah foto -> Senin/Rabu/Jumat saja, hari kerja saja", () => {
  assert.ok(pengingatFoto("2026-11-30", null)?.join(" ").includes("foto awal")); // Senin
  assert.ok(pengingatFoto("2026-12-02", null)); // Rabu
  assert.ok(pengingatFoto("2026-12-04", null)); // Jumat
  assert.equal(pengingatFoto("2026-12-01", null), null); // Selasa
  assert.equal(pengingatFoto("2026-12-05", null), null); // Sabtu
});

test("pengingatFoto: sudah pernah -> Jumat setelah >= 28 hari", () => {
  assert.ok(pengingatFoto("2026-12-25", "2026-11-27")?.join(" ").includes("28 hari")); // Jumat tepat 28 hari
  assert.equal(pengingatFoto("2026-12-18", "2026-11-27"), null); // 21 hari
  assert.equal(pengingatFoto("2026-12-24", "2026-11-20"), null); // Kamis walau sudah lama
});

test("sudutValid", () => {
  assert.equal(sudutValid("depan"), true);
  assert.equal(sudutValid("atas"), false);
});
