import { test } from "node:test";
import assert from "node:assert/strict";
import { pengingatTimbang, type MasukanPengingat } from "./pengingat.ts";

const dasar: MasukanPengingat = {
  today: "2026-12-04", // Jumat
  hariSejakTimbang: 6,
  sudahTimbangMingguIni: false,
  sesiSelesaiMingguIni: 2,
  targetSesi: 3,
};
const teks = (m: Partial<MasukanPengingat>) => pengingatTimbang({ ...dasar, ...m }).baris.join(" ");

test("Jumat dan belum timbang minggu ini: pengingat tegas dengan panduan di gym", () => {
  const r = pengingatTimbang(dasar);
  assert.equal(r.perlu, true);
  const t = r.baris.join(" ");
  assert.ok(t.includes("hari terakhir"));
  assert.ok(t.includes("di gym"));
  assert.ok(t.includes("SEBELUM mulai latihan"));
  assert.ok(t.includes("/timbang 71.4 gym"));
});

test("Kamis: pengingat lembut (kalau ini sesi terakhir)", () => {
  const t = teks({ today: "2026-12-03" });
  assert.ok(t.includes("Kalau hari ini sesi latihan terakhir"));
});

test("sudah timbang minggu ini -> nggak diingatkan di hari apa pun", () => {
  for (const today of ["2026-11-30", "2026-12-01", "2026-12-02", "2026-12-03", "2026-12-04"]) {
    assert.equal(pengingatTimbang({ ...dasar, today, sudahTimbangMingguIni: true, sesiSelesaiMingguIni: 3 }).perlu, false);
  }
});

test("weekend: nggak ada pengingat (nggak ada timbangan di kosan)", () => {
  assert.equal(pengingatTimbang({ ...dasar, today: "2026-12-05" }).perlu, false); // Sabtu
  assert.equal(pengingatTimbang({ ...dasar, today: "2026-12-06", hariSejakTimbang: 20 }).perlu, false); // Minggu
});

test("Senin-Rabu: cuma diingatkan kalau jatah sesi minggu itu sudah terpenuhi", () => {
  assert.equal(pengingatTimbang({ ...dasar, today: "2026-12-01", sesiSelesaiMingguIni: 1 }).perlu, false);
  const r = pengingatTimbang({ ...dasar, today: "2026-12-02", sesiSelesaiMingguIni: 3 });
  assert.equal(r.perlu, true);
  assert.ok(r.baris.join(" ").includes("Jatah sesi minggu ini udah 3"));
});

test("belum pernah timbang -> diingatkan di hari kerja", () => {
  const r = pengingatTimbang({ ...dasar, today: "2026-12-01", hariSejakTimbang: null, sesiSelesaiMingguIni: 0 });
  assert.equal(r.perlu, true);
  assert.ok(r.baris.join(" ").includes("belum pernah timbang"));
});
