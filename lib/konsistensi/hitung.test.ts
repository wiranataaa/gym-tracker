import { test } from "node:test";
import assert from "node:assert/strict";
import { barisTitik, colekanMalam, colekanPagi, ringkasMinggu } from "./hitung.ts";

const KERJA = [1, 2, 3, 4, 5];
// Minggu 30 Nov - 6 Des 2026: Sen 30, Sel 1, Rab 2, Kam 3, Jum 4

test("ringkasMinggu: titik Senin-Jumat dengan status benar", () => {
  const m = ringkasMinggu({ today: "2026-12-02", tanggalSelesai: ["2026-11-30"], hariLatihan: KERJA, target: 3 });
  assert.deepEqual(
    m.titik.map((t) => [t.label, t.status]),
    [["Sen", "selesai"], ["Sel", "lewat"], ["Rab", "hari_ini"], ["Kam", "nanti"], ["Jum", "nanti"]],
  );
  assert.equal(m.selesai, 1);
  assert.equal(m.skor, 33);
  assert.equal(m.butuh, 2);
  assert.equal(m.sisaHari, 3);
  assert.equal(m.masihBisa, true);
});

test("ringkasMinggu: hari ini sudah latihan nggak dihitung sebagai sisa", () => {
  const m = ringkasMinggu({ today: "2026-12-02", tanggalSelesai: ["2026-11-30", "2026-12-02"], hariLatihan: KERJA, target: 3 });
  assert.equal(m.titik.find((t) => t.tanggal === "2026-12-02")?.status, "selesai");
  assert.equal(m.sisaHari, 2);
  assert.equal(m.butuh, 1);
});

test("ringkasMinggu: jatah nggak kekejar kalau sisa hari kurang dari kebutuhan", () => {
  const m = ringkasMinggu({ today: "2026-12-04", tanggalSelesai: [], hariLatihan: KERJA, target: 3 });
  assert.equal(m.sisaHari, 1);
  assert.equal(m.butuh, 3);
  assert.equal(m.masihBisa, false);
});

test("ringkasMinggu: sesi di weekend ikut tampil, dan sesi minggu lalu nggak dihitung", () => {
  const m = ringkasMinggu({ today: "2026-12-05", tanggalSelesai: ["2026-11-29", "2026-12-05"], hariLatihan: KERJA, target: 3 });
  assert.equal(m.selesai, 1); // 29 Nov = Minggu minggu lalu
  assert.deepEqual(m.titik.at(-1), { tanggal: "2026-12-05", label: "Sab", status: "selesai" });
});

test("ringkasMinggu: hari sebelum sesi pertama yang pernah tercatat bukan bolos", () => {
  const m = ringkasMinggu({ today: "2026-12-02", tanggalSelesai: ["2026-12-01", "2026-12-02"], hariLatihan: KERJA, target: 3 });
  assert.deepEqual(
    m.titik.map((t) => t.status),
    ["sebelum", "selesai", "selesai", "nanti", "nanti"],
  );
  // belum ada sesi sama sekali: hari yang lewat juga netral
  const kosong = ringkasMinggu({ today: "2026-12-03", tanggalSelesai: [], hariLatihan: KERJA, target: 3 });
  assert.deepEqual(
    kosong.titik.map((t) => t.status),
    ["sebelum", "sebelum", "sebelum", "hari_ini", "nanti"],
  );
});

test("ringkasMinggu: target 0 nggak bikin error", () => {
  const m = ringkasMinggu({ today: "2026-12-02", tanggalSelesai: [], hariLatihan: KERJA, target: 0 });
  assert.equal(m.skor, 0);
  assert.equal(m.butuh, 0);
  assert.equal(m.masihBisa, true);
});

test("barisTitik: format satu baris", () => {
  const m = ringkasMinggu({ today: "2026-12-02", tanggalSelesai: ["2026-11-30"], hariLatihan: KERJA, target: 3 });
  assert.equal(barisTitik(m.titik), "Sen ✅ · Sel ❌ · Rab 👉 · Kam ▫️ · Jum ▫️");
});

const pagi = (today: string, tanggalSelesai: string[], abaikanHariIni = false) =>
  colekanPagi({ today, tanggalSelesai, hariLatihan: KERJA, abaikanHariIni });

test("colekanPagi: Senin setelah latihan Jumat nggak dicolek (weekend nggak dihitung)", () => {
  const c = pagi("2026-11-30", ["2026-11-27"]);
  assert.equal(c.level, 0);
  assert.equal(c.teks, null);
  assert.equal(c.hariKerjaKosong, 0);
});

test("colekanPagi: 1 hari kosong belum dicolek, 2 hari lembut", () => {
  assert.equal(pagi("2026-12-02", ["2026-11-30"]).level, 0); // Selasa kosong saja
  const c = pagi("2026-12-03", ["2026-11-30"]); // Sel + Rab kosong
  assert.equal(c.level, 1);
  assert.equal(c.hariKerjaKosong, 2);
  assert.ok(c.teks?.includes("2 hari kerja"));
});

test("colekanPagi: 3 hari kerja kosong -> tegas, sebut hari terakhir gym", () => {
  const c = pagi("2026-12-04", ["2026-11-30"]); // Sel, Rab, Kam kosong
  assert.equal(c.level, 2);
  assert.equal(c.hariKerjaKosong, 3);
  assert.equal(c.hariSejak, 4);
  assert.ok(c.teks?.includes("3 hari kerja"));
  assert.ok(c.teks?.includes("4 hari lalu"));
});

test("colekanPagi: libur >= 7 hari -> level 3 dengan persen pemangkasan beban sesuai aturan", () => {
  const sepekan = pagi("2026-12-07", ["2026-11-27"]); // 10 hari
  assert.equal(sepekan.level, 3);
  assert.ok(sepekan.teks?.includes("90%"));
  const duaPekan = pagi("2026-12-14", ["2026-11-27"]); // 17 hari
  assert.equal(duaPekan.level, 3);
  assert.ok(duaPekan.teks?.includes("80%"));
});

test("colekanPagi: persis 7 hari tepat -> 90% (sama seperti aturan kembali dari libur)", () => {
  const c = pagi("2026-12-04", ["2026-11-27"]); // Jumat ke Jumat = 7 hari
  assert.equal(c.level, 3);
  assert.ok(c.teks?.includes("90%"));
});

test("colekanPagi: belum pernah latihan -> ajakan mulai", () => {
  const c = pagi("2026-12-02", []);
  assert.equal(c.level, 1);
  assert.equal(c.hariSejak, null);
});

test("colekanPagi: nggak dicolek di weekend, kalau sudah latihan, atau kalau sengaja di-skip", () => {
  assert.equal(pagi("2026-12-05", ["2026-11-27"]).level, 0); // Sabtu
  assert.equal(pagi("2026-12-04", ["2026-11-27", "2026-12-04"]).level, 0); // sudah latihan hari ini
  assert.equal(pagi("2026-12-04", ["2026-11-27"], true).level, 0); // di-skip / lagi berjalan
});

const malam = (today: string, tanggalSelesai: string[], target = 3, abaikanHariIni = false) =>
  colekanMalam({ today, minggu: ringkasMinggu({ today, tanggalSelesai, hariLatihan: KERJA, target }), hariLatihan: KERJA, abaikanHariIni });

test("colekanMalam: belum latihan hari ini dan jatah belum penuh -> ada colekan dengan angka", () => {
  const t = malam("2026-12-02", ["2026-11-30"]);
  assert.ok(t?.includes("1/3"));
  assert.ok(t?.includes("Kurang 2"));
  assert.ok(t?.includes("sisa 3 hari"));
});

test("colekanMalam: kesempatan terakhir minggu ini disebut", () => {
  const t = malam("2026-12-04", ["2026-11-30", "2026-12-02"]);
  assert.ok(t?.includes("kesempatan terakhir"));
  assert.ok(t?.includes("Kurang 1"));
});

test("colekanMalam: jatah nggak kekejar -> jujur tapi tetap ajak", () => {
  const t = malam("2026-12-04", []);
  assert.ok(t?.includes("nggak kekejar"));
});

test("colekanMalam: diam kalau jatah penuh, sudah latihan hari ini, di-skip, atau weekend", () => {
  assert.equal(malam("2026-12-04", ["2026-11-30", "2026-12-01", "2026-12-02"]), null); // jatah penuh
  assert.equal(malam("2026-12-04", ["2026-12-04"]), null); // sudah latihan
  assert.equal(malam("2026-12-04", [], 3, true), null); // di-skip
  assert.equal(malam("2026-12-05", []), null); // Sabtu
});
