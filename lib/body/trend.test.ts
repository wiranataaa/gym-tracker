import { test } from "node:test";
import assert from "node:assert/strict";
import { dailyValues, movingAverage7, outlook, shift, weeklyRate, windowAverage } from "./trend.ts";

const w = (date: string, weightKg: number) => ({ date, weightKg });

test("dailyValues: rata-rata kalau timbang dua kali sehari, urut tanggal", () => {
  const d = dailyValues([w("2026-12-02", 71.4), w("2026-12-01", 71), w("2026-12-01", 71.4)]);
  assert.deepEqual(d, [w("2026-12-01", 71.2), w("2026-12-02", 71.4)]);
});

test("windowAverage: jendela 7 hari (end-6..end)", () => {
  const d = [w("2026-12-01", 70), w("2026-12-04", 71), w("2026-12-07", 72), w("2026-12-08", 80)];
  assert.equal(windowAverage(d, "2026-12-07"), 71); // 1-7 Des
  assert.equal(windowAverage(d, "2026-12-08"), 74.33); // 2-8 Des: 71,72,80
  assert.equal(windowAverage(d, "2026-12-20"), null);
});

test("movingAverage7 meredam naik-turun harian", () => {
  const d = [w("2026-12-01", 71), w("2026-12-02", 72), w("2026-12-03", 71)];
  const m = movingAverage7(d);
  assert.equal(m[0].weightKg, 71);
  assert.equal(m[1].weightKg, 71.5);
  assert.equal(m[2].weightKg, 71.33);
});

test("weeklyRate: rata-rata minggu ini dikurangi minggu lalu", () => {
  const d = [w("2026-12-01", 71), w("2026-12-03", 71), w("2026-12-08", 71.4), w("2026-12-10", 71.6)];
  // minggu ini (4-10 Des): 71,5 ; minggu lalu (27 Nov-3 Des): 71
  assert.equal(weeklyRate(d, "2026-12-10"), 0.5);
});

test("weeklyRate: data belum cukup -> null", () => {
  assert.equal(weeklyRate([w("2026-12-10", 71)], "2026-12-10"), null);
});

test("shift tanggal lintas bulan dan tahun", () => {
  assert.equal(shift("2026-12-30", 3), "2027-01-02");
  assert.equal(shift("2026-03-01", -1), "2026-02-28");
});

test("outlook: butuh berapa kg/minggu dan proyeksi", () => {
  const d = [w("2026-12-01", 71), w("2026-12-08", 71.3), w("2026-12-15", 71.6)];
  const o = outlook({ daily: d, today: "2026-12-15", targetKg: 75, targetDate: "2027-03-10" })!;
  assert.equal(o.currentAvg, 71.6);
  assert.equal(o.daysLeft, 85);
  // (75 - 71,6) / (85/7) = 0,28
  assert.equal(o.neededPerWeek, 0.28);
  // laju 0,3 kg/minggu x 12,14 minggu + 71,6 = 75,24
  assert.equal(o.projectedKg, 75.24);
});

test("outlook: tanggal target sudah lewat -> nggak ada kebutuhan/proyeksi", () => {
  const o = outlook({ daily: [w("2027-03-12", 74)], today: "2027-03-12", targetKg: 75, targetDate: "2027-03-10" })!;
  assert.equal(o.neededPerWeek, null);
  assert.equal(o.projectedKg, null);
});

test("outlook: belum ada data -> null", () => {
  assert.equal(outlook({ daily: [], today: "2026-12-15", targetKg: 75, targetDate: "2027-03-10" }), null);
});
