"use client";

import { useState, useTransition } from "react";
import { hapusTidurApp, simpanTidurApp } from "../actions.ts";

export type TidurView = {
  tanggalBangun: string;
  jamTidur: string;
  jamBangun: string;
  durasiTeks: string;
  level: "kurang" | "pas" | "cukup";
  label: string;
  kualitas: number | null;
  catatan: string | null;
};

export type RiwayatTidurView = { tanggal: string; hari: string; durasiTeks: string; level: "kurang" | "pas" | "cukup" };

const KUALITAS = [
  { n: 1, emoji: "😫", label: "Parah" },
  { n: 2, emoji: "😕", label: "Gelisah" },
  { n: 3, emoji: "😐", label: "Biasa" },
  { n: 4, emoji: "🙂", label: "Nyenyak" },
  { n: 5, emoji: "😴", label: "Pulas" },
];

const WARNA = { kurang: "bg-red-500/20 text-red-200", pas: "bg-amber-500/20 text-amber-200", cukup: "bg-emerald-500/20 text-emerald-200" };

type Props = {
  /** tidur untuk pagi ini (kalau sudah dicatat) */
  hariIni: TidurView | null;
  riwayat: RiwayatTidurView[];
  /** jam tidur & bangun terakhir, buat isi awal */
  awal: { jamTidur: string; jamBangun: string };
  targetJam: number;
};

// Tidur semalam: dicatat pagi (atau kapan saja hari itu). Jam dipilih lewat pemilih jam bawaan HP, jadi nggak perlu ngetik.
export function PanelTidur({ hariIni, riwayat, awal, targetJam }: Props) {
  const [buka, setBuka] = useState(false);
  const [jamTidur, setJamTidur] = useState(hariIni?.jamTidur ?? awal.jamTidur);
  const [jamBangun, setJamBangun] = useState(hariIni?.jamBangun ?? awal.jamBangun);
  const [kualitas, setKualitas] = useState<number | null>(hariIni?.kualitas ?? null);
  const [catatan, setCatatan] = useState(hariIni?.catatan ?? "");
  const [kemarin, setKemarin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const tampilForm = buka || !hariIni;

  function simpan() {
    setError(null);
    start(async () => {
      const r = await simpanTidurApp({ jamTidur, jamBangun, kualitas, catatan, kemarin });
      if (r.ok) {
        setBuka(false);
        setInfo(kemarin && !hariIni ? "✓ Tersimpan untuk tidur kemarin" : null);
      } else setError(r.error);
    });
  }

  return (
    <section className="space-y-3 rounded-2xl border border-indigo-300/15 bg-indigo-400/[0.06] p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium">😴 Tidur semalam</p>
        {hariIni ? (
          <span className={`rounded-full px-2.5 py-1 text-xs ${WARNA[hariIni.level]}`}>
            {hariIni.durasiTeks} · {hariIni.label}
          </span>
        ) : (
          <span className="text-xs text-slate-400">belum dicatat</span>
        )}
      </div>

      {info && <p className="text-sm text-emerald-300">{info}</p>}

      {hariIni && !tampilForm && (
        <div className="space-y-1.5 text-sm">
          <p className="text-slate-200">
            Tidur <b>{hariIni.jamTidur}</b> → bangun <b>{hariIni.jamBangun}</b>
            {hariIni.kualitas ? ` · ${KUALITAS[hariIni.kualitas - 1].emoji} ${KUALITAS[hariIni.kualitas - 1].label}` : ""}
          </p>
          {hariIni.catatan && <p className="text-slate-400">“{hariIni.catatan}”</p>}
          {hariIni.level !== "cukup" && <p className="text-xs text-slate-500">Target tidur ±{targetJam} jam. Kurang tidur bikin pemulihan otot dan tenaga di gym turun.</p>}
          <div className="flex gap-2 pt-1">
            <button onClick={() => setBuka(true)} className="rounded-xl bg-white/10 px-4 py-2 text-sm active:bg-white/20">
              Ubah
            </button>
            <button
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await hapusTidurApp(hariIni.tanggalBangun);
                  if (!r.ok) setError(r.error);
                })
              }
              className="rounded-xl bg-white/5 px-4 py-2 text-sm text-slate-400 disabled:opacity-60"
            >
              Hapus
            </button>
          </div>
        </div>
      )}

      {tampilForm && (
        <div className="space-y-3">
          {!hariIni && (
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-white/5 p-1 text-sm">
              {[false, true].map((k) => (
                <button key={String(k)} onClick={() => setKemarin(k)} className={`rounded-lg py-2 ${kemarin === k ? "bg-white/15 font-medium" : "text-slate-400"}`}>
                  {k ? "Bangun kemarin" : "Bangun hari ini"}
                </button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1 text-xs text-slate-400">
              Tidur jam
              <input type="time" value={jamTidur} onChange={(e) => setJamTidur(e.target.value)} className="w-full rounded-xl bg-white/10 px-3 py-3 text-lg text-slate-100" />
            </label>
            <label className="space-y-1 text-xs text-slate-400">
              Bangun jam
              <input type="time" value={jamBangun} onChange={(e) => setJamBangun(e.target.value)} className="w-full rounded-xl bg-white/10 px-3 py-3 text-lg text-slate-100" />
            </label>
          </div>

          <div>
            <p className="mb-1.5 text-xs text-slate-400">Tidurnya gimana? (boleh dilewati)</p>
            <div className="grid grid-cols-5 gap-1.5">
              {KUALITAS.map((k) => (
                <button
                  key={k.n}
                  onClick={() => setKualitas(kualitas === k.n ? null : k.n)}
                  className={`rounded-xl py-2 text-center ${kualitas === k.n ? "bg-indigo-400/30 ring-1 ring-indigo-300/60" : "bg-white/10"}`}
                >
                  <span className="block text-xl">{k.emoji}</span>
                  <span className="block text-[10px] text-slate-300">{k.label}</span>
                </button>
              ))}
            </div>
          </div>

          <textarea
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            rows={2}
            maxLength={300}
            placeholder="Cerita dikit: nyenyak nggak? kebangun? susah tidur?"
            className="w-full resize-none rounded-xl bg-white/10 px-3 py-2 text-base placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-300/50"
          />

          {error && <p className="text-sm text-red-300">{error}</p>}
          <div className="flex gap-2">
            <button
              disabled={pending || !jamTidur || !jamBangun}
              onClick={simpan}
              className="flex-1 rounded-xl bg-indigo-400 py-3 font-semibold text-indigo-950 active:scale-[0.98] disabled:opacity-60"
            >
              {pending ? "Menyimpan…" : "Simpan tidur"}
            </button>
            {hariIni && (
              <button onClick={() => setBuka(false)} className="rounded-xl bg-white/10 px-4 text-sm">
                Batal
              </button>
            )}
          </div>
        </div>
      )}

      {riwayat.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-t border-white/5 pt-3">
          {riwayat.map((r) => (
            <span key={r.tanggal} className={`rounded-lg px-2 py-1 text-xs ${WARNA[r.level]}`}>
              {r.hari} {r.durasiTeks}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
