import { test } from "node:test";
import assert from "node:assert/strict";
import { pengingatTimbang } from "./pengingat.ts";

test("Minggu pagi: selalu ada pengingat timbang mingguan", () => {
  const r = pengingatTimbang("2026-11-29", 2); // Minggu
  assert.equal(r.perlu, true);
  assert.ok(r.baris.join(" ").includes("timbang mingguan"));
  assert.ok(r.baris.join(" ").includes("laporan mingguan"));
});

test("hari biasa: baru timbang 3 hari lalu -> nggak diingatkan", () => {
  const r = pengingatTimbang("2026-11-25", 3);
  assert.equal(r.perlu, false);
  assert.deepEqual(r.baris, []);
});

test("hari biasa: 7 hari belum diingatkan, 8 hari baru diingatkan", () => {
  assert.equal(pengingatTimbang("2026-11-25", 7).perlu, false);
  const r = pengingatTimbang("2026-11-25", 8);
  assert.equal(r.perlu, true);
  assert.ok(r.baris.join(" ").includes("8 hari lalu"));
});

test("belum pernah timbang -> diingatkan", () => {
  const r = pengingatTimbang("2026-11-25", null);
  assert.equal(r.perlu, true);
  assert.ok(r.baris.join(" ").includes("Belum ada timbangan"));
});
