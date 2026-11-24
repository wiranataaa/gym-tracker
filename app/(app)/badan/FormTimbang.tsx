"use client";

import { useState, useTransition } from "react";
import type { Kondisi } from "@/lib/body/db.ts";
import { Stepper } from "../_components/Stepper.tsx";
import { simpanTimbangan } from "./actions.ts";

const PILIHAN: { nilai: Kondisi; judul: string; ket: string }[] = [
  { nilai: "sebelum_latihan", judul: "Sebelum latihan (di gym)", ket: "Saran: timbang di gym hari latihan terakhir minggu ini, sebelum mulai. Kondisi yang sama tiap minggu." },
  { nilai: "pagi_puasa", judul: "Pagi, belum makan/minum", ket: "Habis bangun dan ke toilet." },
  { nilai: "setelah_olahraga", judul: "Setelah latihan", ket: "Berat bisa turun sementara karena keringat." },
  { nilai: "lainnya", judul: "Kondisi lain", ket: "Tetap dicatat, tapi nggak dianggap standar." },
];

export function FormTimbang({ awal }: { awal: number }) {
  const [berat, setBerat] = useState(awal);
  const [kondisi, setKondisi] = useState<Kondisi>("sebelum_latihan");
  const [error, setError] = useState<string | null>(null);
  const [tersimpan, setTersimpan] = useState(false);
  const [pending, start] = useTransition();

  function simpan() {
    setError(null);
    setTersimpan(false);
    start(async () => {
      const r = await simpanTimbangan({ weightKg: berat, kondisi });
      if (r.ok) setTersimpan(true);
      else setError(r.error);
    });
  }

  return (
    <div className="space-y-4 rounded-2xl border border-white/5 bg-white/[0.04] p-4">
      <p className="font-medium">⚖️ Catat berat badan</p>
      <Stepper
        label="Berat"
        unit="kg"
        value={berat}
        step={0.1}
        min={30}
        max={250}
        onChange={(n) => {
          setTersimpan(false);
          setBerat(Math.round(n * 10) / 10);
        }}
      />

      <fieldset className="space-y-2">
        <legend className="mb-1 text-xs text-slate-400">Kondisi timbang</legend>
        {PILIHAN.map((p) => (
          <label key={p.nilai} className={`flex cursor-pointer items-start gap-3 rounded-xl p-3 text-sm ${kondisi === p.nilai ? "bg-emerald-500/15 ring-1 ring-emerald-400/40" : "bg-white/5"}`}>
            <input type="radio" name="kondisi" checked={kondisi === p.nilai} onChange={() => setKondisi(p.nilai)} className="mt-0.5 h-5 w-5 accent-emerald-500" />
            <span>
              <span className="font-medium">{p.judul}</span>
              <span className="block text-xs text-slate-400">{p.ket}</span>
            </span>
          </label>
        ))}
      </fieldset>

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
