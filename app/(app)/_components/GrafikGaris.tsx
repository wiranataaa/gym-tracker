"use client";

import { useState } from "react";

export type Titik = { label: string; value: number };

type Props = {
  titik: Titik[];
  satuan?: string;
  warna?: string;
};

const W = 320;
const H = 170;
const PAD = { l: 38, r: 12, t: 14, b: 26 };

const fmt = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");

// Grafik garis sederhana (SVG). Tap titik buat lihat angkanya.
export function GrafikGaris({ titik, satuan = "kg", warna = "#34d399" }: Props) {
  const [sel, setSel] = useState<number | null>(null);
  if (titik.length === 0) return null;

  const vals = titik.map((t) => t.value);
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  if (lo === hi) {
    lo -= 1;
    hi += 1;
  }
  const span = hi - lo;
  lo -= span * 0.15;
  hi += span * 0.15;

  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const x = (i: number) => PAD.l + (titik.length === 1 ? innerW / 2 : (i / (titik.length - 1)) * innerW);
  const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * innerH;

  const path = titik.map((t, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(t.value).toFixed(1)}`).join(" ");
  const grid = [0, 0.5, 1].map((f) => lo + (hi - lo) * f);
  const aktif = sel ?? titik.length - 1;

  return (
    <div>
      <p className="mb-1 text-sm">
        <span className="text-slate-400">{titik[aktif].label}: </span>
        <span className="font-semibold">
          {fmt(titik[aktif].value)} {satuan}
        </span>
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full select-none" role="img">
        {grid.map((g) => (
          <g key={g}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(g)} y2={y(g)} stroke="white" strokeOpacity="0.08" />
            <text x={PAD.l - 6} y={y(g) + 3} textAnchor="end" fontSize="10" fill="#94a3b8">
              {fmt(g)}
            </text>
          </g>
        ))}

        {titik.length > 1 && <path d={path} fill="none" stroke={warna} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}

        {titik.map((t, i) => (
          <g key={i} onClick={() => setSel(i)} className="cursor-pointer">
            <circle cx={x(i)} cy={y(t.value)} r="14" fill="transparent" />
            <circle cx={x(i)} cy={y(t.value)} r={i === aktif ? 5 : 3.5} fill={warna} stroke="#0b0f14" strokeWidth="2" />
          </g>
        ))}

        <text x={x(0)} y={H - 6} textAnchor={titik.length === 1 ? "middle" : "start"} fontSize="10" fill="#94a3b8">
          {titik[0].label}
        </text>
        {titik.length > 1 && (
          <text x={x(titik.length - 1)} y={H - 6} textAnchor="end" fontSize="10" fill="#94a3b8">
            {titik[titik.length - 1].label}
          </text>
        )}
      </svg>
    </div>
  );
}
