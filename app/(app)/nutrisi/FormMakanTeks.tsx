"use client";

import { useState, useTransition } from "react";
import { hitungMakanTeks } from "./actions.ts";

// Kotak ketik buat makanan yang lupa difoto. Hasilnya muncul di daftar Makan sebagai draft (tinggal Simpan).
export function FormMakanTeks() {
  const [teks, setTeks] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function kirim() {
    if (pending || !teks.trim()) return;
    setError(null);
    start(async () => {
      const r = await hitungMakanTeks(teks);
      if (r.ok) setTeks("");
      else setError(r.error);
    });
  }

  return (
    <div className="space-y-2 rounded-2xl border border-white/5 bg-white/[0.04] p-4">
      <p className="text-sm font-medium text-slate-300">✍️ Lupa foto? Ketik aja</p>
      <textarea
        value={teks}
        onChange={(e) => setTeks(e.target.value)}
        disabled={pending}
        rows={2}
        maxLength={300}
        placeholder="Contoh: pizza 2 potong, atau nasi putih + ayam bakar paha + tempe 2"
        className="w-full resize-none rounded-xl bg-white/10 px-3 py-2 text-base placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 disabled:opacity-60"
      />
      {error && <p className="text-sm text-red-300">{error}</p>}
      <button
        onClick={kirim}
        disabled={pending || !teks.trim()}
        className="w-full rounded-xl bg-emerald-500/90 px-4 py-3 font-medium text-black active:bg-emerald-400 disabled:opacity-50"
      >
        {pending ? "🧮 Lagi dihitung…" : "Hitung kalori"}
      </button>
      <p className="text-xs text-slate-500">Hasilnya muncul di daftar Makan di atas. Cek dulu, lalu tap Simpan.</p>
    </div>
  );
}
