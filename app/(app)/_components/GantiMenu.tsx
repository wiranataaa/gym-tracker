"use client";

import { useState, useTransition } from "react";
import type { PilihanMenu } from "@/lib/workout/today.ts";
import { pilihMenuHariIni } from "../actions.ts";

// Ganti menu hari ini. Berguna kalau latihan lebih dari 3x seminggu: menu bonus (D/E/F) menjaga variasi.
export function GantiMenu({ pilihan, saatIni }: { pilihan: PilihanMenu[]; saatIni: number }) {
  const [buka, setBuka] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const utama = pilihan.filter((p) => !p.bonus);
  const bonus = pilihan.filter((p) => p.bonus);

  function pilih(id: number) {
    setError(null);
    start(async () => {
      const r = await pilihMenuHariIni(id);
      if (!r.ok) setError(r.error);
      else setBuka(false);
    });
  }

  if (!buka) {
    return (
      <button onClick={() => setBuka(true)} className="w-full rounded-2xl bg-white/10 px-4 py-3.5 text-sm font-medium active:bg-white/20">
        🔀 Ganti menu
      </button>
    );
  }

  const renderGrup = (judul: string, ket: string, items: PilihanMenu[]) =>
    items.length === 0 ? null : (
      <div>
        <p className="text-sm font-medium">{judul}</p>
        <p className="mb-2 text-xs text-slate-400">{ket}</p>
        <div className="space-y-2">
          {items.map((p) => (
            <button
              key={p.id}
              disabled={pending}
              onClick={() => pilih(p.id)}
              className={`w-full rounded-xl px-4 py-3 text-left text-sm disabled:opacity-60 ${p.id === saatIni ? "bg-emerald-500/20 ring-1 ring-emerald-400/40" : "bg-white/10 active:bg-white/20"}`}
            >
              {p.name}
              {p.id === saatIni ? " · dipilih" : ""}
            </button>
          ))}
        </div>
      </div>
    );

  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.06] p-4">
      {renderGrup("🏋️ Full Body (utama)", "Antrean A → B → C, 3 sesi per minggu.", utama)}
      {renderGrup("✨ Bonus (variasi)", "Buat sesi ke-4 dan seterusnya di minggu yang sama. Nggak menggeser antrean utama.", bonus)}
      {error && <p className="text-sm text-red-300">{error}</p>}
      <button onClick={() => setBuka(false)} className="w-full text-sm text-slate-400">
        Tutup
      </button>
    </div>
  );
}
