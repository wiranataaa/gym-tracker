"use client";

import { useState, useTransition } from "react";
import { fmtInt, fmtKg } from "@/lib/time.ts";
import type { TodayView } from "@/lib/workout/today.ts";
import { mulaiLatihan, skipHariIni, ubahMode } from "../actions.ts";

type Siap = Extract<TodayView, { kind: "siap" }>;

export function PanelMulai({ view }: { view: Siap }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function jalan(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error ?? "Gagal");
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/5 bg-white/[0.04] p-4">
        <div className="flex items-center justify-between">
          <p className="text-lg font-semibold">{view.dayName}</p>
          {view.mode === "singkat" && (
            <span className="rounded-full bg-amber-400/15 px-2.5 py-1 text-xs text-amber-200">Versi singkat ±30 menit</span>
          )}
        </div>

        <ol className="mt-3 space-y-3">
          {view.exercises.map((e, i) => (
            <li key={e.exerciseId} className="flex gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs">{i + 1}</span>
              <div className="min-w-0">
                <p className="font-medium leading-tight">{e.name}</p>
                <p className="text-sm text-slate-300">
                  {e.sets} × {e.repMin}-{e.repMax}
                  {e.targetWeightKg != null ? (
                    <span className="text-emerald-300">
                      {" "}
                      · target {fmtKg(e.targetWeightKg)} kg × {e.targetReps}
                    </span>
                  ) : (
                    <span className="text-slate-500"> · pilih beban sendiri</span>
                  )}
                </p>
                <p className="text-xs text-slate-500">{e.note}</p>
              </div>
            </li>
          ))}
        </ol>

        <p className="mt-4 text-xs text-slate-400">
          🎯 Target hari ini: {fmtInt(view.targetKcal)} kcal · protein {view.targetProteinG} g
        </p>
      </div>

      {error && <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p>}

      <button
        disabled={pending}
        onClick={() => jalan(mulaiLatihan)}
        className="w-full rounded-2xl bg-emerald-500 px-5 py-4 text-lg font-semibold text-emerald-950 active:scale-[0.98] disabled:opacity-60"
      >
        {pending ? "Sebentar…" : "💪 Gas, mulai latihan"}
      </button>

      <div className="grid grid-cols-2 gap-3">
        <button
          disabled={pending}
          onClick={() => jalan(() => ubahMode(view.mode === "singkat" ? "normal" : "singkat"))}
          className="rounded-2xl bg-white/10 px-4 py-3.5 text-sm font-medium active:bg-white/20 disabled:opacity-60"
        >
          {view.mode === "singkat" ? "↩️ Versi lengkap" : "😮‍💨 Lagi capek, versi singkat"}
        </button>
        <button
          disabled={pending}
          onClick={() => jalan(skipHariIni)}
          className="rounded-2xl bg-white/10 px-4 py-3.5 text-sm font-medium active:bg-white/20 disabled:opacity-60"
        >
          ⏭️ Hari ini skip
        </button>
      </div>
    </div>
  );
}
