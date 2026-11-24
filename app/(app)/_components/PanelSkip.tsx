"use client";

import { useTransition } from "react";
import { batalSkip } from "../actions.ts";

export function PanelSkip() {
  const [pending, start] = useTransition();
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.04] p-4">
      <p className="text-lg font-medium">⏭️ Hari ini di-skip</p>
      <p className="mt-1 text-sm text-slate-400">Antrean nggak maju, jadi menu yang sama nunggu lo di sesi berikutnya. Istirahat yang cukup 🙌</p>
      <button
        disabled={pending}
        onClick={() => start(async () => void (await batalSkip()))}
        className="mt-4 w-full rounded-xl bg-white/10 px-4 py-3 font-medium active:bg-white/20 disabled:opacity-60"
      >
        {pending ? "Sebentar…" : "Batal skip, mau latihan"}
      </button>
    </div>
  );
}
