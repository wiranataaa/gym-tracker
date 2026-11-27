"use client";

import { useState, useTransition } from "react";
import { PESAN_WAKTU, type WaktuGym } from "@/lib/program/waktu.ts";
import { pilihWaktuGym } from "../actions.ts";

const PILIHAN: { nilai: WaktuGym; label: string }[] = [
  { nilai: "pagi", label: "☀️ Pagi ini" },
  { nilai: "malam", label: "🌙 Malam ini" },
];

/** Tombol rencana jam gym hari ini. Tap lagi pilihan yang aktif buat mengosongkan. */
export function PilihWaktu({ saatIni }: { saatIni: WaktuGym | null }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function pilih(w: WaktuGym) {
    setError(null);
    start(async () => {
      const r = await pilihWaktuGym(saatIni === w ? null : w);
      if (!r.ok) setError(r.error);
    });
  }

  return (
    <div className="space-y-2 rounded-2xl border border-white/5 bg-white/[0.04] p-4">
      <p className="text-sm font-medium">🕒 Gym jam berapa hari ini?</p>
      <div className="grid grid-cols-2 gap-2">
        {PILIHAN.map((p) => (
          <button
            key={p.nilai}
            disabled={pending}
            aria-pressed={saatIni === p.nilai}
            onClick={() => pilih(p.nilai)}
            className={`rounded-xl py-3 text-sm font-medium active:scale-[0.98] disabled:opacity-60 ${saatIni === p.nilai ? "bg-emerald-500 text-emerald-950" : "bg-white/10"}`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {saatIni && <p className="text-xs text-slate-400">{PESAN_WAKTU[saatIni]}</p>}
      {error && <p className="text-sm text-red-300">{error}</p>}
    </div>
  );
}
