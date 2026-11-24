"use client";

import { useState, useTransition } from "react";
import { labelFaktor, PORTION_FACTORS } from "@/lib/nutrition/calc.ts";
import { fmtInt, fmtKg } from "@/lib/time.ts";
import { hapusMakan, jadikanFavorit, simpanMakan, ubahPorsi } from "./actions.ts";

export type MakanView = {
  id: number;
  jam: string;
  deskripsi: string;
  foto: string | null;
  status: "draft" | "tersimpan";
  sumber: string;
  factor: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  kcalMin: number | null;
  kcalMax: number | null;
  keyakinan: string | null;
  items: { id: number; name: string; portionG: number | null; kcal: number; proteinG: number }[];
};

const KONFIDENSI: Record<string, string> = { rendah: "🟠 rendah", sedang: "🟡 sedang", tinggi: "🟢 tinggi" };

export function KartuMakan({ m }: { m: MakanView }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [buka, setBuka] = useState(m.status === "draft");

  function jalan(fn: () => Promise<{ ok: boolean; error?: string }>, pesan?: string) {
    setError(null);
    setInfo(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error ?? "Gagal");
      else if (pesan) setInfo(pesan);
    });
  }

  return (
    <section className={`rounded-2xl border bg-white/[0.04] ${m.status === "draft" ? "border-amber-400/30" : "border-white/5"}`}>
      <button onClick={() => setBuka(!buka)} className="flex w-full items-start gap-3 p-3 text-left">
        {m.foto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={m.foto} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-white/5 text-2xl">🍽️</div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{m.deskripsi}</p>
          <p className="text-xs text-slate-400">
            {m.jam} · {m.sumber}
            {m.status === "draft" ? " · belum disimpan" : ""}
          </p>
          <p className="mt-1 text-sm">
            <b>{fmtInt(m.kcal)}</b> kcal · protein <b>{fmtKg(m.proteinG)}</b> g
          </p>
        </div>
      </button>

      {buka && (
        <div className="space-y-3 border-t border-white/5 p-3">
          <ul className="space-y-1 text-sm">
            {m.items.map((i) => (
              <li key={i.id} className="flex justify-between gap-3 text-slate-300">
                <span className="min-w-0 truncate">
                  {i.name}
                  {i.portionG ? <span className="text-slate-500"> ±{fmtInt(i.portionG * m.factor)} g</span> : null}
                </span>
                <span className="shrink-0">
                  {fmtInt(i.kcal * m.factor)} kcal · P {fmtKg(i.proteinG * m.factor)}
                </span>
              </li>
            ))}
          </ul>

          <p className="text-xs text-slate-400">
            Karbo {fmtKg(m.carbsG)} g · Lemak {fmtKg(m.fatG)} g
            {m.kcalMin != null && m.kcalMax != null ? ` · kisaran ${fmtInt(m.kcalMin)}–${fmtInt(m.kcalMax)} kcal` : ""}
            {m.keyakinan ? ` · keyakinan ${KONFIDENSI[m.keyakinan] ?? m.keyakinan}` : ""}
          </p>

          <div>
            <p className="mb-1.5 text-xs text-slate-400">Porsi</p>
            <div className="grid grid-cols-4 gap-2">
              {PORTION_FACTORS.map((f) => (
                <button
                  key={f}
                  disabled={pending}
                  onClick={() => jalan(() => ubahPorsi(m.id, f))}
                  className={`rounded-xl py-2.5 text-sm font-medium disabled:opacity-60 ${m.factor === f ? "bg-emerald-500 text-emerald-950" : "bg-white/10"}`}
                >
                  {labelFaktor(f)}x
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-300">{error}</p>}
          {info && <p className="text-sm text-emerald-300">{info}</p>}

          {m.status === "draft" && (
            <button
              disabled={pending}
              onClick={() => jalan(() => simpanMakan(m.id))}
              className="w-full rounded-2xl bg-emerald-500 py-3.5 text-base font-semibold text-emerald-950 active:scale-[0.98] disabled:opacity-60"
            >
              {pending ? "Menyimpan…" : "✅ Simpan"}
            </button>
          )}

          <div className="grid grid-cols-2 gap-2">
            {m.sumber !== "favorit" && (
              <button
                disabled={pending}
                onClick={() => jalan(() => jadikanFavorit(m.id), "⭐ Masuk favorit")}
                className="rounded-xl bg-white/10 py-2.5 text-sm disabled:opacity-60"
              >
                ⭐ Jadikan favorit
              </button>
            )}
            {!confirmDel ? (
              <button onClick={() => setConfirmDel(true)} className="rounded-xl py-2.5 text-sm text-red-300 active:bg-red-500/10">
                🗑️ {m.status === "draft" ? "Buang" : "Hapus"}
              </button>
            ) : (
              <div className="flex gap-1.5">
                <button disabled={pending} onClick={() => jalan(() => hapusMakan(m.id))} className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                  Ya
                </button>
                <button onClick={() => setConfirmDel(false)} className="flex-1 rounded-xl bg-white/10 py-2.5 text-sm">
                  Batal
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
