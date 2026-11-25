import assert from "node:assert/strict";
import { test } from "node:test";
import { bacaJam, bacaTidurTeks, fmtDurasi, fmtJam, jamWIB, nilaiTidur, rataMenit, susunWaktuTidur } from "./hitung.ts";

test("bacaJam: berbagai penulisan jam", () => {
  assert.equal(bacaJam("23:30"), 23 * 60 + 30);
  assert.equal(bacaJam("23.30"), 23 * 60 + 30);
  assert.equal(bacaJam("2330"), 23 * 60 + 30);
  assert.equal(bacaJam("6"), 360);
  assert.equal(bacaJam("6:05"), 365);
  assert.equal(bacaJam("24:00"), null);
  assert.equal(bacaJam("12:60"), null);
  assert.equal(bacaJam("halo"), null);
});

test("fmtJam membulat ke 24 jam", () => {
  assert.equal(fmtJam(390), "06:30");
  assert.equal(fmtJam(0), "00:00");
  assert.equal(fmtJam(1440 + 60), "01:00");
});

test("susunWaktuTidur: tidur sebelum tengah malam masuk ke tanggal sebelumnya", () => {
  const r = susunWaktuTidur("2026-11-26", "23:30", "06:00");
  assert.ok(r.ok);
  assert.equal(r.waktu.sleptAt, "2026-11-25T23:30:00+07:00");
  assert.equal(r.waktu.wokeAt, "2026-11-26T06:00:00+07:00");
  assert.equal(r.waktu.durasiMenit, 390);
});

test("susunWaktuTidur: tidur lewat tengah malam tetap di tanggal bangun", () => {
  const r = susunWaktuTidur("2026-11-26", "00:30", "06:00");
  assert.ok(r.ok);
  assert.equal(r.waktu.sleptAt, "2026-11-26T00:30:00+07:00");
  assert.equal(r.waktu.durasiMenit, 330);
});

test("susunWaktuTidur: pergantian bulan dan tahun", () => {
  const r = susunWaktuTidur("2027-01-01", "22:00", "05:30");
  assert.ok(r.ok);
  assert.equal(r.waktu.sleptAt, "2026-12-31T22:00:00+07:00");
  assert.equal(r.waktu.durasiMenit, 450);
});

test("susunWaktuTidur: menolak jam yang nggak masuk akal", () => {
  assert.equal(susunWaktuTidur("2026-11-26", "06:00", "06:00").ok, false);
  assert.equal(susunWaktuTidur("2026-11-26", "abc", "06:00").ok, false);
  // 14:00 -> 06:00 = 16 jam (batas), 13:00 -> 06:00 = 17 jam (ditolak)
  assert.equal(susunWaktuTidur("2026-11-26", "14:00", "06:00").ok, true);
  assert.equal(susunWaktuTidur("2026-11-26", "13:00", "06:00").ok, false);
  assert.equal(susunWaktuTidur("2026-11-26", "05:45", "06:00").ok, false);
});

test("jamWIB mengubah waktu ISO jadi jam WIB", () => {
  assert.equal(jamWIB("2026-11-25T23:30:00+07:00"), "23:30");
  assert.equal(jamWIB("2026-11-25T16:05:00Z"), "23:05");
});

test("fmtDurasi", () => {
  assert.equal(fmtDurasi(390), "6 jam 30 menit");
  assert.equal(fmtDurasi(420), "7 jam");
  assert.equal(fmtDurasi(45), "45 menit");
});

test("nilaiTidur: batas 7 jam dan 6 jam", () => {
  assert.equal(nilaiTidur(420).level, "cukup");
  assert.equal(nilaiTidur(419).level, "pas");
  assert.equal(nilaiTidur(360).level, "pas");
  assert.equal(nilaiTidur(359).level, "kurang");
});

test("bacaTidurTeks: jam + catatan", () => {
  assert.deepEqual(bacaTidurTeks("23:30 6:00 nyenyak banget"), { jamTidur: "23:30", jamBangun: "06:00", catatan: "nyenyak banget" });
  assert.deepEqual(bacaTidurTeks("tidur jam 23.30 bangun jam 6"), { jamTidur: "23:30", jamBangun: "06:00", catatan: "" });
  assert.deepEqual(bacaTidurTeks("nyenyak 0:15 sampai 5:30"), { jamTidur: "00:15", jamBangun: "05:30", catatan: "nyenyak" });
  assert.equal(bacaTidurTeks("23:30"), null);
  assert.equal(bacaTidurTeks(""), null);
});

test("rataMenit", () => {
  assert.equal(rataMenit([]), null);
  assert.equal(rataMenit([360, 420, 480]), 420);
});
