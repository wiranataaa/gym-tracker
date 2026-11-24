import { test } from "node:test";
import assert from "node:assert/strict";
import { BATAS_KEKURANGAN_G, labelOpsi, opsiCampuran, opsiTunggal, saranProtein } from "./saran.ts";

test("opsiTunggal: jumlah dibulatkan ke atas dan menutup kekurangan", () => {
  const o = opsiTunggal(40);
  for (const x of o) assert.ok(x.proteinG >= 40, `${x.nama} hanya ${x.proteinG} g`);
  const ayam = o.find((x) => x.nama === "Dada ayam matang");
  assert.equal(ayam?.jumlah, 2); // 2 x 31 = 62 g
});

test("opsiTunggal: sumber yang butuh jumlah di luar batas wajar nggak ditawarkan", () => {
  const o = opsiTunggal(60);
  assert.ok(!o.some((x) => x.nama === "Tahu putih")); // butuh 8 x 100 g
  assert.ok(!o.some((x) => x.nama === "Telur")); // butuh 10 butir
});

test("opsiTunggal: diurutkan dari paling hemat kalori per gram protein", () => {
  const o = opsiTunggal(30);
  for (let i = 1; i < o.length; i++) assert.ok(o[i - 1].kcal / o[i - 1].proteinG <= o[i].kcal / o[i].proteinG);
});

test("opsiCampuran: dua sumber, total protein mendekati kekurangan", () => {
  const c = opsiCampuran(50)!;
  assert.equal(c.length, 2);
  const total = c.reduce((a, x) => a + x.proteinG, 0);
  assert.ok(total >= 40 && total <= 75, `total ${total}`);
});

test("saranProtein: kekurangan besar ditandai dan dibatasi", () => {
  const s = saranProtein(120);
  assert.equal(s.terlaluBanyak, true);
  assert.ok(s.tunggal.every((x) => x.proteinG >= BATAS_KEKURANGAN_G));
});

test("saranProtein: kekurangan 0 -> nggak ada saran", () => {
  const s = saranProtein(0);
  assert.equal(s.campuran, null);
  assert.equal(s.tunggal.length, 0);
});

test("labelOpsi terbaca", () => {
  assert.match(labelOpsi({ nama: "Telur", jumlah: 4, satuan: "butir", proteinG: 24, kcal: 300 }), /4 butir Telur \(24 g protein, ±300 kcal\)/);
});
