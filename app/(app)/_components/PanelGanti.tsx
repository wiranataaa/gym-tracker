"use client";

import { useState, useTransition } from "react";
import type { Calon } from "@/lib/workout/ganti.ts";
import { calonGantiApp, gantiGerakanApp } from "../actions.ts";

/** Tombol "Ganti gerakan" + daftar penggantinya (diambil saat dibuka). Berlaku buat sesi ini saja. */
export function PanelGanti({ exerciseId, onGanti }: { exerciseId: number; onGanti: (keId: number) => void }) {
  const [calon, setCalon] = useState<Calon[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function buka() {
    setError(null);
    start(async () => {
      const r = await calonGantiApp(exerciseId);
      if (r.ok) setCalon(r.calon);
      else setError(r.error);
    });
  }

  function pilih(keId: number) {
    setError(null);
    start(async () => {
      const r = await gantiGerakanApp(exerciseId, keId);
      if (r.ok) {
        setCalon(null);
        onGanti(keId);
      } else setError(r.error);
    });
  }

  return (
    <div className="space-y-2">
      {calon == null ? (
        <button disabled={pending} onClick={buka} className="w-full rounded-xl bg-white/5 px-4 py-3 text-sm text-slate-300 active:bg-white/15 disabled:opacity-60">
          {pending ? "Nyari pengganti…" : "🔁 Alatnya penuh? Ganti gerakan"}
        </button>
      ) : (
        <div className="space-y-2 rounded-xl border border-sky-300/20 bg-sky-400/[0.06] p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Ganti pakai apa?</p>
            <button onClick={() => setCalon(null)} className="rounded-lg px-2 py-1 text-xs text-slate-400">
              Batal
            </button>
          </div>
          {calon.length === 0 && <p className="text-sm text-slate-400">Belum ada pengganti buat gerakan ini. Lewati aja kalau alatnya nggak kosong-kosong.</p>}
          {calon.map((c) => (
            <button key={c.id} disabled={pending} onClick={() => pilih(c.id)} className="w-full rounded-xl bg-white/10 px-3 py-2.5 text-left active:bg-white/20 disabled:opacity-60">
              <span className="block text-sm font-medium">{c.name}</span>
              <span className="block text-xs text-slate-400">
                {c.alat} · {c.target}
              </span>
            </button>
          ))}
          <p className="text-xs text-slate-500">Cuma buat sesi ini. Menu program nggak berubah.</p>
        </div>
      )}
      {error && <p className="text-sm text-red-300">{error}</p>}
    </div>
  );
}
