"use client";

import { useState, useTransition } from "react";
import { Stepper } from "../_components/Stepper.tsx";
import { simpanTimbangan } from "./actions.ts";

export function FormTimbang({ awal }: { awal: number }) {
  const [berat, setBerat] = useState(awal);
  const [standar, setStandar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tersimpan, setTersimpan] = useState(false);
  const [pending, start] = useTransition();

  function simpan() {
    setError(null);
    setTersimpan(false);
    start(async () => {
      const r = await simpanTimbangan({ weightKg: berat, standar });
      if (r.ok) setTersimpan(true);
      else setError(r.error);
    });
  }

  return (
    <div className="space-y-4 rounded-2xl border border-white/5 bg-white/[0.04] p-4">
      <p className="font-medium">⚖️ Catat berat badan</p>
      <Stepper label="Berat" unit="kg" value={berat} step={0.1} min={30} max={250} onChange={(n) => { setTersimpan(false); setBerat(Math.round(n * 10) / 10); }} />

      <label className="flex items-start gap-3 rounded-xl bg-white/5 p-3 text-sm">
        <input type="checkbox" checked={standar} onChange={(e) => setStandar(e.target.checked)} className="mt-0.5 h-5 w-5 accent-emerald-500" />
        <span>
          <span className="font-medium">Kondisi standar</span>
          <span className="block text-xs text-slate-400">Pagi, habis bangun dan ke toilet, belum makan atau minum, sebelum olahraga. Biar tren-nya akurat.</span>
        </span>
      </label>

      {error && <p className="text-sm text-red-300">{error}</p>}
      {tersimpan && <p className="text-sm text-emerald-300">✅ Tersimpan</p>}

      <button
        disabled={pending}
        onClick={simpan}
        className="w-full rounded-2xl bg-emerald-500 px-5 py-4 text-lg font-semibold text-emerald-950 active:scale-[0.98] disabled:opacity-60"
      >
        {pending ? "Menyimpan…" : "Simpan timbangan"}
      </button>
    </div>
  );
}
