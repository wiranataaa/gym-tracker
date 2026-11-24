"use client";

import { useState, useTransition } from "react";
import { simpanKardio } from "../actions.ts";
import { Stepper } from "./Stepper.tsx";

type Props = {
  menitSaran: number;
  deskripsi: string;
  alasan: string;
  /** menit yang sudah tercatat di sesi ini */
  tersimpan: number | null;
};

// Kardio: saran menit dari kode, dicatat setelah selesai (jalan di treadmill).
export function KartuKardio({ menitSaran, deskripsi, alasan, tersimpan }: Props) {
  const [menit, setMenit] = useState(tersimpan ?? menitSaran);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function simpan(nilai: number) {
    setError(null);
    start(async () => {
      const r = await simpanKardio(nilai);
      if (!r.ok) setError(r.error);
    });
  }

  return (
    <section className="space-y-3 rounded-2xl border border-white/5 bg-white/[0.04] p-4">
      <div className="flex items-center justify-between">
        <p className="font-medium">🚶 Kardio</p>
        {tersimpan ? <span className="rounded-full bg-emerald-500/20 px-2.5 py-1 text-xs text-emerald-200">✓ {tersimpan} menit</span> : <span className="text-xs text-slate-400">saran {menitSaran} menit</span>}
      </div>
      <p className="text-sm text-slate-300">{deskripsi}</p>
      {alasan && <p className="text-xs text-slate-500">{alasan}</p>}

      <Stepper label="Menit" unit="menit" value={menit} step={5} min={0} max={240} onChange={(n) => setMenit(Math.round(n))} />

      {error && <p className="text-sm text-red-300">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button
          disabled={pending}
          onClick={() => simpan(menit)}
          className="rounded-xl bg-emerald-500 py-3 font-semibold text-emerald-950 active:scale-[0.98] disabled:opacity-60"
        >
          {pending ? "Menyimpan…" : tersimpan ? "Perbarui" : "Simpan kardio"}
        </button>
        {tersimpan ? (
          <button disabled={pending} onClick={() => simpan(0)} className="rounded-xl bg-white/10 py-3 text-sm disabled:opacity-60">
            Hapus catatan
          </button>
        ) : (
          <span className="flex items-center justify-center text-xs text-slate-500">Setelah angkat beban</span>
        )}
      </div>
    </section>
  );
}
