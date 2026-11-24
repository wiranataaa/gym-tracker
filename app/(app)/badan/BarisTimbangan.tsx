"use client";

import { useState, useTransition } from "react";
import { fmtKg, tglPendek } from "@/lib/time.ts";
import { hapusTimbangan } from "./actions.ts";

type Props = {
  id: number;
  date: string;
  weightKg: number;
  /** teks kondisi, mis. "sebelum latihan (gym)" */
  kondisi: string;
  standar: boolean;
  sumber: string;
};

export function BarisTimbangan({ id, date, weightKg, kondisi, standar, sumber }: Props) {
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <li className="rounded-xl bg-white/5 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="font-medium">{fmtKg(weightKg)} kg</p>
          <p className="text-xs text-slate-400">
            {tglPendek(date)} · {kondisi}
            {standar ? " ✓" : " (non-standar)"} · {sumber}
          </p>
        </div>
        {!confirm ? (
          <button onClick={() => setConfirm(true)} className="rounded-lg px-3 py-1.5 text-sm text-red-300 active:bg-red-500/10">
            Hapus
          </button>
        ) : (
          <div className="flex gap-1.5">
            <button
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await hapusTimbangan(id);
                  if (!r.ok) setError(r.error);
                })
              }
              className="rounded-lg bg-red-500 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              Ya
            </button>
            <button onClick={() => setConfirm(false)} className="rounded-lg bg-white/10 px-3 py-1.5 text-sm">
              Batal
            </button>
          </div>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-300">{error}</p>}
    </li>
  );
}
