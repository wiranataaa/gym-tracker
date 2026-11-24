"use client";

import { useState, useTransition } from "react";
import { fmtInt, fmtKg } from "@/lib/time.ts";
import { hapusFavorit, pakaiFavorit } from "./actions.ts";

export type FavView = { id: number; name: string; kcal: number; proteinG: number };

export function PanelFavorit({ favs, bisaCatat }: { favs: FavView[]; bisaCatat: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [edit, setEdit] = useState(false);

  if (favs.length === 0) {
    return (
      <p className="rounded-2xl border border-white/5 bg-white/[0.04] p-4 text-sm text-slate-400">
        Belum ada favorit. Buka makanan lalu tap <b className="text-slate-200">⭐ Jadikan favorit</b>, nanti bisa dicatat sekali tap di sini.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-red-300">{error}</p>}
      <ul className="space-y-2">
        {favs.map((f) => (
          <li key={f.id} className="flex items-center gap-2">
            <button
              disabled={pending || !bisaCatat || edit}
              onClick={() => {
                setError(null);
                start(async () => {
                  const r = await pakaiFavorit(f.id);
                  if (!r.ok) setError(r.error);
                });
              }}
              className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-2xl border border-white/5 bg-white/[0.04] px-4 py-3 text-left active:bg-white/10 disabled:opacity-60"
            >
              <span className="min-w-0 truncate">⭐ {f.name}</span>
              <span className="shrink-0 text-sm text-slate-300">
                {fmtInt(f.kcal)} kcal · P {fmtKg(f.proteinG)}
              </span>
            </button>
            {edit && (
              <button
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await hapusFavorit(f.id);
                    if (!r.ok) setError(r.error);
                  })
                }
                className="rounded-xl bg-red-500/15 px-3 py-3 text-sm text-red-300"
              >
                Hapus
              </button>
            )}
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between px-1 text-xs text-slate-500">
        <span>{bisaCatat ? "Tap buat dicatat sebagai makan hari ini" : "Pindah ke hari ini buat mencatat favorit"}</span>
        <button onClick={() => setEdit(!edit)} className="text-slate-400">
          {edit ? "Selesai" : "Kelola"}
        </button>
      </div>
    </div>
  );
}
