"use client";

import { useMemo, useState, useTransition } from "react";
import { fmtKg } from "@/lib/time.ts";
import type { ExerciseView, LoggedSet, TodayView } from "@/lib/workout/today.ts";
import { hapusSet, selesaiLatihan, simpanSet } from "../actions.ts";
import { KartuKardio } from "./KartuKardio.tsx";
import { Stepper } from "./Stepper.tsx";

type Berjalan = Extract<TodayView, { kind: "berjalan" }>;
type Draft = { weight: number; reps: number };

const ENERGI = [
  { n: 1, emoji: "😵", label: "Habis" },
  { n: 2, emoji: "😕", label: "Capek" },
  { n: 3, emoji: "😐", label: "Biasa" },
  { n: 4, emoji: "🙂", label: "Segar" },
  { n: 5, emoji: "💪", label: "Fit" },
];

export function Pencatat({ view }: { view: Berjalan }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [rpe, setRpe] = useState<Record<number, number | null>>({});
  const [warmup, setWarmup] = useState<Record<number, boolean>>({});
  const [confirmDel, setConfirmDel] = useState<number | null>(null);
  const [showEnergy, setShowEnergy] = useState(false);

  const workingBy = useMemo(() => {
    const m = new Map<number, LoggedSet[]>();
    for (const s of view.logged) m.set(s.exerciseId, [...(m.get(s.exerciseId) ?? []), s]);
    return m;
  }, [view.logged]);

  const doneCount = (e: ExerciseView) => (workingBy.get(e.exerciseId) ?? []).filter((s) => !s.isWarmup).length;
  const firstOpen = view.exercises.find((e) => doneCount(e) < e.sets)?.exerciseId ?? view.exercises[0]?.exerciseId ?? null;
  const [openId, setOpenId] = useState<number | null>(firstOpen);

  const totalPlanned = view.exercises.reduce((a, e) => a + e.sets, 0);
  const totalDone = view.exercises.reduce((a, e) => a + Math.min(doneCount(e), e.sets), 0);

  function draftFor(e: ExerciseView): Draft {
    const d = drafts[e.exerciseId];
    if (d) return d;
    const list = (workingBy.get(e.exerciseId) ?? []).filter((s) => !s.isWarmup);
    const last = list[list.length - 1];
    return {
      // Gerakan berat badan sendiri mulai dari beban tambahan 0; lainnya dari target, atau 20 kg kalau belum ada riwayat
      weight: last?.weightKg ?? (e.bodyweight ? 0 : (e.targetWeightKg ?? 20)),
      reps: last?.reps ?? e.targetReps,
    };
  }

  function setDraft(e: ExerciseView, patch: Partial<Draft>) {
    setDrafts((prev) => ({ ...prev, [e.exerciseId]: { ...draftFor(e), ...patch } }));
  }

  function jalan(fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) {
    setError(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error ?? "Gagal");
      else after?.();
    });
  }

  function simpan(e: ExerciseView) {
    const d = draftFor(e);
    const isWarmup = !!warmup[e.exerciseId];
    jalan(
      () => simpanSet({ exerciseId: e.exerciseId, weightKg: d.weight, reps: d.reps, rpe: rpe[e.exerciseId] ?? null, isWarmup }),
      () => {
        // Simpan nilai terakhir sebagai default set berikutnya; pindah ke gerakan berikut kalau set penuh
        setDrafts((prev) => ({ ...prev, [e.exerciseId]: d }));
        setRpe((prev) => ({ ...prev, [e.exerciseId]: null }));
        if (!isWarmup && doneCount(e) + 1 >= e.sets) {
          const idx = view.exercises.findIndex((x) => x.exerciseId === e.exerciseId);
          const next = view.exercises.slice(idx + 1).find((x) => doneCount(x) < x.sets);
          if (next) setOpenId(next.exerciseId);
        }
      },
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-2xl bg-emerald-500/10 px-4 py-3">
        <div>
          <p className="font-semibold">{view.dayName}</p>
          <p className="text-xs text-emerald-200/70">{view.mode === "singkat" ? "Versi singkat" : "Sesi berjalan"}</p>
        </div>
        <p className="text-sm text-emerald-200">
          {totalDone}/{totalPlanned} set
        </p>
      </div>

      {error && <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p>}

      {view.exercises.map((e) => {
        const logged = workingBy.get(e.exerciseId) ?? [];
        const n = doneCount(e);
        const open = openId === e.exerciseId;
        const d = draftFor(e);
        const penuh = n >= e.sets;

        return (
          <section
            key={e.exerciseId}
            className={`rounded-2xl border bg-white/[0.04] ${open ? "border-emerald-400/30" : "border-white/5"}`}
          >
            <button onClick={() => setOpenId(open ? null : e.exerciseId)} className="flex w-full items-start justify-between gap-3 p-4 text-left">
              <div className="min-w-0">
                <p className="font-medium leading-tight">{e.name}</p>
                <p className="mt-0.5 text-sm text-slate-300">
                  {e.sets} × {e.repMin}-{e.repMax}
                  {e.targetWeightKg != null && (
                    <span className="text-emerald-300">
                      {" "}
                      · target {fmtKg(e.targetWeightKg)} kg × {e.targetReps}
                    </span>
                  )}
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs ${penuh ? "bg-emerald-500/20 text-emerald-200" : "bg-white/10 text-slate-300"}`}>
                {penuh ? "✓ " : ""}
                {Math.min(n, e.sets)}/{e.sets}
              </span>
            </button>

            {logged.length > 0 && (
              <div className="flex flex-wrap gap-2 px-4 pb-3">
                {logged.map((s) =>
                  confirmDel === s.id ? (
                    <span key={s.id} className="flex items-center gap-1 rounded-full bg-red-500/15 py-1 pl-3 pr-1 text-sm">
                      Hapus?
                      <button
                        disabled={pending}
                        onClick={() => jalan(() => hapusSet(s.id), () => setConfirmDel(null))}
                        className="rounded-full bg-red-500 px-3 py-1 text-xs font-semibold text-white"
                      >
                        Ya
                      </button>
                      <button onClick={() => setConfirmDel(null)} className="rounded-full bg-white/10 px-3 py-1 text-xs">
                        Batal
                      </button>
                    </span>
                  ) : (
                    <button
                      key={s.id}
                      onClick={() => setConfirmDel(s.id)}
                      className={`rounded-full px-3 py-1 text-sm ${s.isWarmup ? "bg-white/5 text-slate-400" : "bg-white/10"}`}
                      title="Tap buat hapus"
                    >
                      {s.isWarmup ? "🔥 " : ""}
                      {fmtKg(s.weightKg)} × {s.reps}
                      {s.rpe ? ` · RPE ${s.rpe}` : ""}
                    </button>
                  ),
                )}
              </div>
            )}

            {open && (
              <div className="space-y-4 border-t border-white/5 p-4">
                <p className="text-xs text-slate-500">{e.note}</p>
                <Stepper
                  label={e.bodyweight ? "Beban tambahan (0 = berat badan)" : "Beban"}
                  unit="kg"
                  value={d.weight}
                  step={e.stepKg}
                  max={500}
                  onChange={(w) => setDraft(e, { weight: w })}
                />
                <Stepper label="Reps" value={d.reps} step={1} min={1} max={100} onChange={(r) => setDraft(e, { reps: Math.round(r) })} />

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-400">RPE</span>
                  {[6, 7, 8, 9, 10].map((v) => (
                    <button
                      key={v}
                      onClick={() => setRpe((p) => ({ ...p, [e.exerciseId]: p[e.exerciseId] === v ? null : v }))}
                      className={`h-9 w-9 rounded-full text-sm ${rpe[e.exerciseId] === v ? "bg-emerald-500 font-semibold text-emerald-950" : "bg-white/10"}`}
                    >
                      {v}
                    </button>
                  ))}
                  <label className="ml-auto flex items-center gap-2 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked={!!warmup[e.exerciseId]}
                      onChange={(ev) => setWarmup((p) => ({ ...p, [e.exerciseId]: ev.target.checked }))}
                      className="h-4 w-4 accent-emerald-500"
                    />
                    Pemanasan
                  </label>
                </div>

                <button
                  disabled={pending}
                  onClick={() => simpan(e)}
                  className="w-full rounded-2xl bg-emerald-500 px-5 py-4 text-lg font-semibold text-emerald-950 active:scale-[0.98] disabled:opacity-60"
                >
                  {pending ? "Menyimpan…" : `Simpan set ${warmup[e.exerciseId] ? "pemanasan" : n + 1}`}
                </button>
              </div>
            )}
          </section>
        );
      })}

      <KartuKardio menitSaran={view.kardio.menit} deskripsi={view.kardio.deskripsi} alasan={view.kardio.alasan} tersimpan={view.cardioMin} />

      {!showEnergy ? (
        <button onClick={() => setShowEnergy(true)} className="w-full rounded-2xl bg-white/10 px-5 py-4 text-base font-medium active:bg-white/20">
          🏁 Selesai latihan
        </button>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
          <p className="mb-3 text-center font-medium">Seberapa berenergi lo tadi?</p>
          <div className="grid grid-cols-5 gap-2">
            {ENERGI.map((x) => (
              <button
                key={x.n}
                disabled={pending}
                onClick={() => jalan(() => selesaiLatihan(x.n))}
                className="flex flex-col items-center gap-1 rounded-xl bg-white/10 py-3 active:bg-emerald-500/30 disabled:opacity-60"
              >
                <span className="text-2xl">{x.emoji}</span>
                <span className="text-[11px] text-slate-300">{x.label}</span>
              </button>
            ))}
          </div>
          <button onClick={() => setShowEnergy(false)} className="mt-3 w-full text-sm text-slate-400">
            Belum, lanjut latihan
          </button>
        </div>
      )}
    </div>
  );
}
