"use client";

import { useState, useTransition } from "react";
import { fmtKg } from "@/lib/time.ts";
import { Stepper } from "../../_components/Stepper.tsx";
import { hapusSetRiwayat, ubahSet } from "../actions.ts";

type Props = {
  nomor: number;
  set: { id: number; weightKg: number; reps: number; rpe: number | null; isWarmup: boolean };
};

export function BarisSet({ nomor, set }: Props) {
  const [edit, setEdit] = useState(false);
  const [weight, setWeight] = useState(set.weightKg);
  const [reps, setReps] = useState(set.reps);
  const [rpe, setRpe] = useState<number | null>(set.rpe);
  const [confirmDel, setConfirmDel] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function jalan(fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) {
    setError(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error ?? "Gagal");
      else after?.();
    });
  }

  if (!edit) {
    return (
      <button
        onClick={() => setEdit(true)}
        className="flex w-full items-center justify-between rounded-xl bg-white/5 px-3 py-2.5 text-left active:bg-white/10"
      >
        <span className="text-sm text-slate-400">
          {set.isWarmup ? "🔥 Pemanasan" : `Set ${nomor}`}
        </span>
        <span>
          {fmtKg(set.weightKg)} kg × {set.reps}
          {set.rpe ? <span className="text-sm text-slate-400"> · RPE {set.rpe}</span> : null}
        </span>
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-emerald-400/30 bg-black/20 p-3">
      <Stepper label="Beban" unit="kg" value={weight} step={2} onChange={setWeight} />
      <Stepper label="Reps" value={reps} step={1} min={1} max={100} onChange={(r) => setReps(Math.round(r))} />
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-400">RPE</span>
        {[6, 7, 8, 9, 10].map((v) => (
          <button
            key={v}
            onClick={() => setRpe(rpe === v ? null : v)}
            className={`h-9 w-9 rounded-full text-sm ${rpe === v ? "bg-emerald-500 font-semibold text-emerald-950" : "bg-white/10"}`}
          >
            {v}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-300">{error}</p>}

      <div className="grid grid-cols-2 gap-2">
        <button
          disabled={pending}
          onClick={() => jalan(() => ubahSet({ setId: set.id, weightKg: weight, reps, rpe }), () => setEdit(false))}
          className="rounded-xl bg-emerald-500 py-3 font-semibold text-emerald-950 disabled:opacity-60"
        >
          {pending ? "Menyimpan…" : "Simpan"}
        </button>
        <button onClick={() => setEdit(false)} className="rounded-xl bg-white/10 py-3">
          Batal
        </button>
      </div>

      {!confirmDel ? (
        <button onClick={() => setConfirmDel(true)} className="w-full py-1 text-sm text-red-300">
          Hapus set ini
        </button>
      ) : (
        <div className="flex items-center justify-between rounded-xl bg-red-500/10 px-3 py-2">
          <span className="text-sm">Yakin hapus?</span>
          <div className="flex gap-2">
            <button disabled={pending} onClick={() => jalan(() => hapusSetRiwayat(set.id))} className="rounded-lg bg-red-500 px-3 py-1.5 text-sm font-semibold text-white">
              Ya, hapus
            </button>
            <button onClick={() => setConfirmDel(false)} className="rounded-lg bg-white/10 px-3 py-1.5 text-sm">
              Batal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
