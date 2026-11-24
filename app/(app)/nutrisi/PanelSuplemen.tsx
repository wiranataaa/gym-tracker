"use client";

import { useState, useTransition } from "react";
import { fmtInt, fmtKg } from "@/lib/time.ts";
import { Stepper } from "../_components/Stepper.tsx";
import { batalSuplemenApp, catatSuplemenApp, ubahSuplemenApp } from "./actions.ts";

export type SuplemenView = {
  id: number;
  name: string;
  doseDesc: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  pengingat: boolean;
  /** berapa kali tercatat hari ini */
  count: number;
};

const adaMakro = (s: { kcal: number; proteinG: number }) => s.kcal > 0 || s.proteinG > 0;

export function PanelSuplemen({ items, bisaCatat }: { items: SuplemenView[]; bisaCatat: boolean }) {
  if (items.length === 0) {
    return <p className="rounded-2xl border border-white/5 bg-white/[0.04] p-4 text-sm text-slate-400">Belum ada suplemen.</p>;
  }
  return (
    <div className="space-y-2">
      {items.map((s) => (
        <KartuSuplemen key={`${s.id}-${s.kcal}-${s.proteinG}-${s.doseDesc}-${s.pengingat}`} s={s} bisaCatat={bisaCatat} />
      ))}
      <p className="px-1 text-xs text-slate-500">
        Whey ikut dihitung ke kalori dan protein hari ini. Atur angkanya sesuai label di kemasan produk lo. Creatine nggak punya kalori, jadi cuma dicatat sebagai konsistensi harian.
      </p>
    </div>
  );
}

function KartuSuplemen({ s, bisaCatat }: { s: SuplemenView; bisaCatat: boolean }) {
  const makro = adaMakro(s);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [atur, setAtur] = useState(false);
  const [dose, setDose] = useState(s.doseDesc);
  const [kcal, setKcal] = useState(s.kcal);
  const [protein, setProtein] = useState(s.proteinG);
  const [karbo, setKarbo] = useState(s.carbsG);
  const [lemak, setLemak] = useState(s.fatG);
  const [ingat, setIngat] = useState(s.pengingat);

  function jalan(fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) {
    setError(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error ?? "Gagal");
      else after?.();
    });
  }

  const udah = s.count > 0;

  return (
    <section className="rounded-2xl border border-white/5 bg-white/[0.04] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">
            {makro ? "🥤" : "💊"} {s.name}
          </p>
          <p className="text-xs text-slate-400">
            {s.doseDesc}
            {makro ? ` · ${fmtInt(s.kcal)} kcal · P ${fmtKg(s.proteinG)} g` : " · tanpa kalori"}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs ${udah ? "bg-emerald-500/20 text-emerald-200" : "bg-white/10 text-slate-300"}`}>
          {makro ? `${s.count}x hari ini` : udah ? "✓ udah" : "belum"}
        </span>
      </div>

      {error && <p className="mt-2 text-sm text-red-300">{error}</p>}

      <div className="mt-3 flex gap-2">
        {makro ? (
          <>
            <button disabled={pending || !bisaCatat} onClick={() => jalan(() => catatSuplemenApp(s.id))} className="flex-1 rounded-xl bg-emerald-500 py-3 font-semibold text-emerald-950 active:scale-[0.98] disabled:opacity-50">
              {pending ? "…" : "➕ +1 dosis"}
            </button>
            {udah && (
              <button disabled={pending} onClick={() => jalan(() => batalSuplemenApp(s.id))} className="rounded-xl bg-white/10 px-4 py-3 text-sm disabled:opacity-60">
                ↩️ Batal
              </button>
            )}
          </>
        ) : udah ? (
          <button disabled={pending} onClick={() => jalan(() => batalSuplemenApp(s.id))} className="flex-1 rounded-xl bg-white/10 py-3 text-sm disabled:opacity-60">
            ↩️ Batalkan catatan hari ini
          </button>
        ) : (
          <button disabled={pending || !bisaCatat} onClick={() => jalan(() => catatSuplemenApp(s.id))} className="flex-1 rounded-xl bg-emerald-500 py-3 font-semibold text-emerald-950 active:scale-[0.98] disabled:opacity-50">
            {pending ? "…" : "✅ Udah diminum"}
          </button>
        )}
        <button onClick={() => setAtur(!atur)} className="rounded-xl bg-white/10 px-4 py-3 text-sm">
          {atur ? "Tutup" : "Atur"}
        </button>
      </div>

      {atur && (
        <div className="mt-3 space-y-3 border-t border-white/5 pt-3">
          <label className="block text-xs text-slate-400">
            Takaran
            <input value={dose} onChange={(e) => setDose(e.target.value)} maxLength={60} className="mt-1 w-full rounded-xl bg-black/30 px-3 py-2.5 text-sm text-slate-100 outline-none ring-1 ring-white/10 focus:ring-emerald-400/60" />
          </label>
          <Stepper label="Kalori per dosis" unit="kcal" value={kcal} step={5} max={1500} onChange={(n) => setKcal(Math.round(n))} />
          <Stepper label="Protein per dosis" unit="g" value={protein} step={0.5} max={200} onChange={setProtein} />
          <Stepper label="Karbo per dosis" unit="g" value={karbo} step={0.5} max={300} onChange={setKarbo} />
          <Stepper label="Lemak per dosis" unit="g" value={lemak} step={0.5} max={150} onChange={setLemak} />
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" checked={ingat} onChange={(e) => setIngat(e.target.checked)} className="h-5 w-5 accent-emerald-500" />
            Ingatkan di pesan pagi dan malam kalau belum dicatat
          </label>
          <button
            disabled={pending}
            onClick={() => jalan(() => ubahSuplemenApp(s.id, { doseDesc: dose, kcal, proteinG: protein, carbsG: karbo, fatG: lemak, pengingat: ingat }), () => setAtur(false))}
            className="w-full rounded-xl bg-emerald-500 py-3 font-semibold text-emerald-950 disabled:opacity-60"
          >
            {pending ? "Menyimpan…" : "Simpan pengaturan"}
          </button>
          <p className="text-xs text-slate-500">Perubahan angka berlaku untuk dosis berikutnya. Catatan yang sudah ada tidak berubah.</p>
        </div>
      )}
    </section>
  );
}
