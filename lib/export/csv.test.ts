import { test } from "node:test";
import assert from "node:assert/strict";
import { buatCsv, sel } from "./csv.ts";

test("sel: angka, kosong, dan teks biasa apa adanya", () => {
  assert.equal(sel(62.5), "62.5");
  assert.equal(sel(null), "");
  assert.equal(sel(undefined), "");
  assert.equal(sel("Bench Press"), "Bench Press");
});

test("sel: koma, kutip, dan baris baru dibungkus dan di-escape", () => {
  assert.equal(sel("nasi, ayam"), '"nasi, ayam"');
  assert.equal(sel('dia bilang "mantap"'), '"dia bilang ""mantap"""');
  assert.equal(sel("baris1\nbaris2"), '"baris1\nbaris2"');
});

test("sel: teks yang diawali = + @ diberi apostrof supaya nggak dibaca sebagai rumus", () => {
  assert.equal(sel("=1+1"), "'=1+1");
  assert.equal(sel("@cmd"), "'@cmd");
  assert.equal(sel("+62812"), "'+62812");
  assert.equal(sel(-5), "-5"); // angka negatif asli tetap angka
});

test("buatCsv: BOM, header, baris, dan akhir baris CRLF", () => {
  const csv = buatCsv(["tanggal", "gerakan", "beban"], [["2026-12-01", "Bench, flat", 60], ["2026-12-02", "Squat", 80]]);
  assert.ok(csv.startsWith("﻿tanggal,gerakan,beban\r\n"));
  assert.ok(csv.includes('2026-12-01,"Bench, flat",60\r\n'));
  assert.ok(csv.endsWith("2026-12-02,Squat,80\r\n"));
});
