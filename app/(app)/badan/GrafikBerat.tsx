"use client";

import { useMemo, useState } from "react";
import { daysBetween, shift } from "@/lib/body/trend.ts";
import { tglSingkat } from "@/lib/time.ts";

type Titik = { date: string; weightKg: number };

type Props = {
  harian: Titik[];
  rata7: Titik[];
  targetKg: number;
  targetDate: string;
  hariIni: string;
};

const W = 320;
const H = 200;
const PAD = { l: 38, r: 12, t: 14, b: 26 };
const fmt = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");

// Titik = timbangan harian, garis hijau = rata-rata 7 hari, garis putus-putus = jalur menuju target.
export function GrafikBerat({ harian, rata7, targetKg, targetDate, hariIni }: Props) {
  const [mode, setMode] = useState<"lebaran" | "30hari">("30hari");
  const [sel, setSel] = useState<number | null>(null);

  const g = useMemo(() => {
    if (harian.length === 0) return null;
    const first = harian[0];
    const lastDate = harian[harian.length - 1].date;
    const endData = lastDate > hariIni ? lastDate : hariIni;

    let start: string;
    let end: string;
    if (mode === "lebaran") {
      start = first.date;
      end = targetDate > endData ? targetDate : endData;
    } else {
      end = endData;
      start = shift(end, -30);
    }
    if (daysBetween(start, end) < 7) start = shift(end, -7);

    // Jalur target: lurus dari timbangan pertama ke target di tanggal target
    const slope = daysBetween(first.date, targetDate) > 0 ? (targetKg - first.weightKg) / daysBetween(first.date, targetDate) : 0;
    const at = (d: string) => first.weightKg + slope * daysBetween(first.date, d);
    const tStart = first.date > start ? first.date : start;
    const tEnd = targetDate < end ? targetDate : end;
    const targetLine = daysBetween(tStart, tEnd) > 0 ? { a: { date: tStart, v: at(tStart) }, b: { date: tEnd, v: at(tEnd) } } : null;

    const visHarian = harian.filter((d) => d.date >= start && d.date <= end);
    const visAvg = rata7.filter((d) => d.date >= start && d.date <= end);

    const ys = [...visHarian.map((d) => d.weightKg), ...visAvg.map((d) => d.weightKg)];
    if (targetLine) ys.push(targetLine.a.v, targetLine.b.v);
    if (ys.length === 0) return null;
    let lo = Math.min(...ys);
    let hi = Math.max(...ys);
    if (lo === hi) {
      lo -= 1;
      hi += 1;
    }
    const pad = (hi - lo) * 0.12;
    return { start, end, lo: lo - pad, hi: hi + pad, targetLine, visHarian, visAvg };
  }, [harian, rata7, mode, targetDate, targetKg, hariIni]);

  if (!g) return null;

  const total = daysBetween(g.start, g.end);
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const x = (d: string) => PAD.l + (daysBetween(g.start, d) / total) * innerW;
  const y = (v: number) => PAD.t + (1 - (v - g.lo) / (g.hi - g.lo)) * innerH;
  const grid = [0, 0.5, 1].map((f) => g.lo + (g.hi - g.lo) * f);

  const avgPath = g.visAvg.map((d, i) => `${i === 0 ? "M" : "L"}${x(d.date).toFixed(1)},${y(d.weightKg).toFixed(1)}`).join(" ");
  const aktif = sel != null && sel < g.visHarian.length ? sel : g.visHarian.length - 1;
  const dipilih = g.visHarian[aktif];
  const avgDipilih = dipilih ? rata7.find((d) => d.date === dipilih.date) : undefined;
  const targetDiDalam = targetDate >= g.start && targetDate <= g.end;

  return (
    <div>
      <div className="mb-3 flex gap-2">
        {(["30hari", "lebaran"] as const).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMode(m);
              setSel(null);
            }}
            className={`rounded-full px-3.5 py-1.5 text-sm ${mode === m ? "bg-emerald-500 font-semibold text-emerald-950" : "bg-white/10"}`}
          >
            {m === "30hari" ? "30 hari" : "Menuju target"}
          </button>
        ))}
      </div>

      <p className="mb-1 min-h-5 text-sm">
        {dipilih ? (
          <>
            <span className="text-slate-400">{tglSingkat(dipilih.date)}: </span>
            <span className="font-semibold">{fmt(dipilih.weightKg)} kg</span>
            {avgDipilih && <span className="text-slate-400"> · rata-rata 7 hari {fmt(avgDipilih.weightKg)} kg</span>}
          </>
        ) : (
          <span className="text-slate-500">Belum ada timbangan di rentang ini</span>
        )}
      </p>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full select-none" role="img">
        {grid.map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="white" strokeOpacity="0.08" />
            <text x={PAD.l - 6} y={y(v) + 3} textAnchor="end" fontSize="10" fill="#94a3b8">
              {fmt(v)}
            </text>
          </g>
        ))}

        {g.targetLine && (
          <line
            x1={x(g.targetLine.a.date)}
            y1={y(g.targetLine.a.v)}
            x2={x(g.targetLine.b.date)}
            y2={y(g.targetLine.b.v)}
            stroke="#fbbf24"
            strokeWidth="1.8"
            strokeDasharray="5 4"
          />
        )}
        {targetDiDalam && (
          <g>
            <circle cx={x(targetDate)} cy={y(targetKg)} r="4" fill="#fbbf24" />
            <text x={x(targetDate)} y={y(targetKg) - 8} textAnchor="end" fontSize="10" fill="#fbbf24">
              {fmt(targetKg)} kg
            </text>
          </g>
        )}

        {g.visAvg.length > 1 && <path d={avgPath} fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}

        {g.visHarian.map((d, i) => (
          <g key={d.date} onClick={() => setSel(i)} className="cursor-pointer">
            <circle cx={x(d.date)} cy={y(d.weightKg)} r="14" fill="transparent" />
            <circle cx={x(d.date)} cy={y(d.weightKg)} r={i === aktif ? 5 : 3} fill={i === aktif ? "#ffffff" : "#94a3b8"} stroke="#0b0f14" strokeWidth="1.5" />
          </g>
        ))}

        <text x={PAD.l} y={H - 6} fontSize="10" fill="#94a3b8">
          {tglSingkat(g.start)}
        </text>
        <text x={W - PAD.r} y={H - 6} textAnchor="end" fontSize="10" fill="#94a3b8">
          {tglSingkat(g.end)}
        </text>
      </svg>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
        <span>
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-slate-400" />
          Timbangan harian
        </span>
        <span>
          <span className="mr-1 inline-block h-1 w-3 rounded bg-emerald-400" />
          Rata-rata 7 hari
        </span>
        <span>
          <span className="mr-1 inline-block h-0.5 w-3 border-t-2 border-dashed border-amber-400" />
          Jalur ke target
        </span>
      </div>
    </div>
  );
}
