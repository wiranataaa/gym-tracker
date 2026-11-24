"use client";

import { useState, useTransition } from "react";
import { PANDUAN_DELOAD } from "@/lib/program/deload.ts";
import { akhiriDeloadApp, mulaiDeloadApp } from "./actions.ts";

type Props = { aktif: boolean; sampai: string | null; perlu: boolean; alasan: string[] };

export function KartuDeload({ aktif, sampai, perlu, alasan }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function jalan(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error ?? "Gagal");
    });
  }

  return (
    <section className="space-y-3 rounded-2xl border border-white/5 bg-white/[0.04] p-4">
      <p className="font-medium">🔋 Deload (minggu ringan)</p>
      {aktif ? (
        <>
          <p className="rounded-xl bg-sky-400/10 p-3 text-sm text-sky-100">Lagi berjalan{sampai ? ` sampai ${sampai}` : ""}. Menu hari ini otomatis versi ringan.</p>
          <button disabled={pending} onClick={() => jalan(akhiriDeloadApp)} className="w-full rounded-xl bg-white/10 py-3 disabled:opacity-60">
            Akhiri deload sekarang
          </button>
        </>
      ) : (
        <>
          {perlu ? (
            <div className="rounded-xl bg-amber-400/10 p-3 text-sm text-amber-100">
              <p className="mb-1 font-medium">Disarankan deload:</p>
              <ul className="list-disc space-y-0.5 pl-5">
                {alasan.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-slate-400">Belum perlu. Disarankan otomatis tiap ±7 minggu latihan, atau kalau performa turun di banyak gerakan 2 sesi berturut-turut.</p>
          )}
          <button disabled={pending} onClick={() => jalan(mulaiDeloadApp)} className="w-full rounded-xl bg-emerald-500 py-3 font-semibold text-emerald-950 disabled:opacity-60">
            {pending ? "Sebentar…" : "Mulai deload 7 hari"}
          </button>
        </>
      )}
      {error && <p className="text-sm text-red-300">{error}</p>}
      <p className="text-xs text-slate-500">{PANDUAN_DELOAD}</p>
    </section>
  );
}
