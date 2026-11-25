import { test } from "node:test";
import assert from "node:assert/strict";
import { KUTIPAN, KUTIPAN_SELESAI, kutipanHariIni, kutipanSelesai, kutipanUntuk } from "./kutipan.ts";
import { addDays } from "./time.ts";

test("tiap kutipan unik dan nggak kosong", () => {
  assert.equal(new Set(KUTIPAN).size, KUTIPAN.length);
  assert.ok(KUTIPAN.every((k) => k.trim().length > 10));
  assert.ok(KUTIPAN.length >= 50);
});

test("tanggal yang sama selalu memberi kutipan yang sama", () => {
  assert.equal(kutipanHariIni("2026-11-25"), kutipanHariIni("2026-11-25"));
});

test("hari berturut-turut selalu beda", () => {
  let tgl = "2026-11-25";
  for (let i = 0; i < 400; i++) {
    const besok = addDays(tgl, 1);
    assert.notEqual(kutipanHariIni(tgl), kutipanHariIni(besok), `${tgl} sama dengan ${besok}`);
    tgl = besok;
  }
});

test("semua kutipan keluar tepat sekali dalam satu putaran (nggak ada yang berulang sebelum habis)", () => {
  const muncul = new Set<string>();
  let tgl = "2027-01-01";
  for (let i = 0; i < KUTIPAN.length; i++) {
    muncul.add(kutipanHariIni(tgl));
    tgl = addDays(tgl, 1);
  }
  assert.equal(muncul.size, KUTIPAN.length);
});

test("kutipan setelah latihan juga bergantian dan berasal dari daftarnya sendiri", () => {
  assert.ok(KUTIPAN_SELESAI.includes(kutipanSelesai("2026-11-25")));
  assert.notEqual(kutipanSelesai("2026-11-25"), kutipanSelesai("2026-11-26"));
});

test("daftar kosong -> string kosong, nggak error", () => {
  assert.equal(kutipanUntuk("2026-11-25", []), "");
});
