import { test } from "node:test";
import assert from "node:assert/strict";
import { bagiRamadan, hariKeRamadan, kurangiVolumeRamadan, ramadanAktif, type PengaturanRamadan } from "./ramadan.ts";

const auto: PengaturanRamadan = { override: "auto", mulai: "2027-02-08", lebaran: "2027-03-10" };

test("auto: aktif dari hari pertama sampai sehari sebelum Lebaran", () => {
  assert.equal(ramadanAktif("2027-02-07", auto), false);
  assert.equal(ramadanAktif("2027-02-08", auto), true);
  assert.equal(ramadanAktif("2027-03-01", auto), true);
  assert.equal(ramadanAktif("2027-03-09", auto), true);
  assert.equal(ramadanAktif("2027-03-10", auto), false); // hari Lebaran bukan puasa
  assert.equal(ramadanAktif("2026-11-24", auto), false);
});

test("override 'on' dan 'off' mengalahkan tanggal", () => {
  assert.equal(ramadanAktif("2026-11-24", { ...auto, override: "on" }), true);
  assert.equal(ramadanAktif("2027-02-20", { ...auto, override: "off" }), false);
});

test("tanggal Ramadan bisa digeser (ditetapkan pemerintah)", () => {
  const geser: PengaturanRamadan = { override: "auto", mulai: "2027-02-09", lebaran: "2027-03-11" };
  assert.equal(ramadanAktif("2027-02-08", geser), false);
  assert.equal(ramadanAktif("2027-02-09", geser), true);
});

test("hariKeRamadan: hitung mundur, null kalau sudah mulai", () => {
  assert.equal(hariKeRamadan("2027-01-25", "2027-02-08"), 14);
  assert.equal(hariKeRamadan("2027-02-08", "2027-02-08"), null);
  assert.equal(hariKeRamadan("2027-02-10", "2027-02-08"), null);
});

test("bagiRamadan: tiga waktu makan, totalnya mendekati target", () => {
  const p = bagiRamadan(2450, 135);
  assert.deepEqual(p.map((x) => x.nama), ["Sahur", "Berbuka", "Setelah tarawih"]);
  const kcal = p.reduce((a, x) => a + x.kcal, 0);
  const prot = p.reduce((a, x) => a + x.proteinG, 0);
  assert.ok(Math.abs(kcal - 2450) <= 30, `kcal ${kcal}`);
  assert.ok(Math.abs(prot - 135) <= 10, `protein ${prot}`);
  assert.ok(p.every((x) => x.kcal % 10 === 0 && x.proteinG % 5 === 0));
});

test("volume Ramadan: kurangi 1 set di gerakan non-inti yang >= 3 set", () => {
  assert.equal(kurangiVolumeRamadan(3, false), 2);
  assert.equal(kurangiVolumeRamadan(3, true), 3);
  assert.equal(kurangiVolumeRamadan(2, false), 2);
});
