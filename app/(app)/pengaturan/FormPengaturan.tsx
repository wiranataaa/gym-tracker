"use client";

import { useState, useTransition } from "react";
import type { Pengaturan } from "@/lib/pengaturan/db.ts";
import type { OverrideRamadan } from "@/lib/ramadan/ramadan.ts";
import { Stepper } from "../_components/Stepper.tsx";
import { simpanPengaturan } from "./actions.ts";

const MODE: { nilai: OverrideRamadan; judul: string; ket: string }[] = [
  { nilai: "auto", judul: "Otomatis", ket: "Aktif sendiri di tanggal Ramadan di bawah." },
  { nilai: "on", judul: "Selalu aktif", ket: "Paksa mode Ramadan sekarang." },
  { nilai: "off", judul: "Selalu mati", ket: "Abaikan tanggal Ramadan." },
];

export function FormPengaturan({ awal }: { awal: Pengaturan }) {
  const [p, setP] = useState<Pengaturan>(awal);
  const [error, setError] = useState<string | null>(null);
  const [tersimpan, setTersimpan] = useState(false);
  const [pending, start] = useTransition();

  const ubah = <K extends keyof Pengaturan>(k: K, v: Pengaturan[K]) => {
    setTersimpan(false);
    setP((prev) => ({ ...prev, [k]: v }));
  };

  function simpan() {
    setError(null);
    setTersimpan(false);
    start(async () => {
      const r = await simpanPengaturan(p);
      if (r.ok) setTersimpan(true);
      else setError(r.error);
    });
  }

  return (
    <div className="space-y-4">
      <section className="space-y-4 rounded-2xl border border-white/5 bg-white/[0.04] p-4">
        <p className="font-medium">🍽️ Target nutrisi</p>
        <Stepper label="Kalori (lean bulk)" unit="kcal" value={p.targetKcal} step={50} min={1800} max={4500} onChange={(n) => ubah("targetKcal", Math.round(n))} />
        <Stepper label="Kalori maintenance (saat Ramadan)" unit="kcal" value={p.kcalMaintenance} step={50} min={1800} max={4500} onChange={(n) => ubah("kcalMaintenance", Math.round(n))} />
        <Stepper label="Protein" unit="g" value={p.targetProteinG} step={5} min={60} max={300} onChange={(n) => ubah("targetProteinG", Math.round(n))} />
        <p className="text-xs text-slate-500">Target kalori lean bulk juga disesuaikan otomatis tiap Minggu malam (±150 kcal) berdasarkan laju berat badan.</p>
      </section>

      <section className="space-y-4 rounded-2xl border border-white/5 bg-white/[0.04] p-4">
        <p className="font-medium">🎯 Target dan latihan</p>
        <Stepper label="Target berat utama" unit="kg" value={p.targetWeightKg} step={0.5} min={40} max={150} onChange={(n) => ubah("targetWeightKg", n)} />
        <Stepper label="Target lanjutan (setelah Lebaran)" unit="kg" value={p.stretchTargetKg} step={0.5} min={40} max={150} onChange={(n) => ubah("stretchTargetKg", n)} />
        <div>
          <p className="mb-1.5 text-xs uppercase tracking-wide text-slate-400">Target sesi per minggu</p>
          <div className="grid grid-cols-5 gap-2">
            {[2, 3, 4, 5, 6].map((n) => (
              <button key={n} onClick={() => ubah("sessionsPerWeek", n)} className={`rounded-xl py-3 font-medium ${p.sessionsPerWeek === n ? "bg-emerald-500 text-emerald-950" : "bg-white/10"}`}>
                {n}x
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-slate-500">Dipakai buat skor konsistensi dan streak di laporan mingguan.</p>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-white/5 bg-white/[0.04] p-4">
        <p className="font-medium">🌙 Mode Ramadan</p>
        <div className="space-y-2">
          {MODE.map((m) => (
            <label key={m.nilai} className={`flex cursor-pointer items-start gap-3 rounded-xl p-3 text-sm ${p.ramadanOverride === m.nilai ? "bg-emerald-500/15 ring-1 ring-emerald-400/40" : "bg-white/5"}`}>
              <input type="radio" name="ramadan" checked={p.ramadanOverride === m.nilai} onChange={() => ubah("ramadanOverride", m.nilai)} className="mt-0.5 h-5 w-5 accent-emerald-500" />
              <span>
                <span className="font-medium">{m.judul}</span>
                <span className="block text-xs text-slate-400">{m.ket}</span>
              </span>
            </label>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs text-slate-400">
            Hari pertama puasa
            <input type="date" value={p.ramadanStart} onChange={(e) => ubah("ramadanStart", e.target.value)} className="mt-1 w-full rounded-xl bg-black/30 px-3 py-3 text-sm text-slate-100 outline-none ring-1 ring-white/10 focus:ring-emerald-400/60" />
          </label>
          <label className="block text-xs text-slate-400">
            Hari Lebaran
            <input type="date" value={p.lebaranDate} onChange={(e) => ubah("lebaranDate", e.target.value)} className="mt-1 w-full rounded-xl bg-black/30 px-3 py-3 text-sm text-slate-100 outline-none ring-1 ring-white/10 focus:ring-emerald-400/60" />
          </label>
        </div>
        <p className="text-xs text-slate-500">Tanggal resmi ditetapkan pemerintah, jadi bisa lo geser kapan pun. Saat aktif: target kalori jadi maintenance, volume latihan dikurangi, kardio maksimal 15 menit, dan target kalori nggak disesuaikan otomatis.</p>
      </section>

      {error && <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p>}
      {tersimpan && <p className="rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">✅ Pengaturan tersimpan</p>}

      <button disabled={pending} onClick={simpan} className="w-full rounded-2xl bg-emerald-500 px-5 py-4 text-lg font-semibold text-emerald-950 active:scale-[0.98] disabled:opacity-60">
        {pending ? "Menyimpan…" : "Simpan pengaturan"}
      </button>
    </div>
  );
}
