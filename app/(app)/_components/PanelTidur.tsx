"use client";

import { useState, useTransition } from "react";
import { fmtDurasi, nilaiTidur, susunWaktuTidurTanggal, tebakTanggalTidur } from "@/lib/tidur/hitung.ts";
import { namaHari, tglSingkat } from "@/lib/time.ts";
import { hapusTidurApp, simpanTidurApp } from "../actions.ts";

export type TidurView = {
  tanggalBangun: string;
  tanggalTidur: string;
  jamTidur: string;
  jamBangun: string;
  durasiMenit: number;
  kualitas: number | null;
  catatan: string | null;
};

const KUALITAS = [
  { n: 1, emoji: "😫", label: "Parah" },
  { n: 2, emoji: "😕", label: "Gelisah" },
  { n: 3, emoji: "😐", label: "Biasa" },
  { n: 4, emoji: "🙂", label: "Nyenyak" },
  { n: 5, emoji: "😴", label: "Pulas" },
];

const WARNA = { kurang: "bg-red-500/20 text-red-200", pas: "bg-amber-500/20 text-amber-200", cukup: "bg-emerald-500/20 text-emerald-200" };

const hariTanggal = (d: string) => (d ? `${namaHari(d)}, ${tglSingkat(d)}` : "pilih tanggal");
const durasiPendek = (menit: number) => fmtDurasi(menit).replace(" jam ", "j ").replace(" menit", "m").replace(" jam", "j");

type Props = {
  /** tanggal hari ini (WIB) */
  today: string;
  /** catatan tidur 14 hari terakhir, terbaru dulu */
  daftar: TidurView[];
  /** jam tidur & bangun terakhir, buat isi awal */
  awal: { jamTidur: string; jamBangun: string };
  targetJam: number;
};

type Isian = {
  /** tanggal bangun catatan yang sedang diubah; null = catatan baru */
  asal: string | null;
  tanggalTidur: string;
  jamTidur: string;
  tanggalBangun: string;
  jamBangun: string;
  /** tanggal tidur sudah diubah sendiri, jadi jangan ditebak ulang */
  manual: boolean;
  kualitas: number | null;
  catatan: string;
};

// Tidur: tanggal dan jam tidur serta bangun diisi sendiri (nama harinya muncul), jadi nggak bingung lewat tengah malam.
export function PanelTidur({ today, daftar, awal, targetJam }: Props) {
  const hariIni = daftar.find((t) => t.tanggalBangun === today) ?? null;

  const isianBaru = (): Isian => ({
    asal: null,
    tanggalBangun: today,
    jamBangun: awal.jamBangun,
    tanggalTidur: tebakTanggalTidur(today, awal.jamTidur, awal.jamBangun),
    jamTidur: awal.jamTidur,
    manual: false,
    kualitas: null,
    catatan: "",
  });
  const isianDari = (t: TidurView): Isian => ({
    asal: t.tanggalBangun,
    tanggalBangun: t.tanggalBangun,
    jamBangun: t.jamBangun,
    tanggalTidur: t.tanggalTidur,
    jamTidur: t.jamTidur,
    manual: true,
    kualitas: t.kualitas,
    catatan: t.catatan ?? "",
  });

  const [isian, setIsian] = useState<Isian | null>(() => (hariIni ? null : isianBaru()));
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function buka(i: Isian) {
    setError(null);
    setInfo(null);
    setIsian(i);
  }

  /** Ubah isian; tanggal tidur ikut ditebak ulang selama belum diubah sendiri. */
  function ubah(patch: Partial<Isian>) {
    setIsian((p) => {
      if (!p) return p;
      const n = { ...p, ...patch };
      if (!n.manual && n.tanggalBangun) n.tanggalTidur = tebakTanggalTidur(n.tanggalBangun, n.jamTidur, n.jamBangun);
      return n;
    });
  }

  const cek = isian ? susunWaktuTidurTanggal(isian) : null;
  const tertimpa = isian ? daftar.find((t) => t.tanggalBangun === isian.tanggalBangun && t.tanggalBangun !== isian.asal) : undefined;

  function simpan() {
    if (!isian) return;
    setError(null);
    start(async () => {
      const r = await simpanTidurApp(isian);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setInfo(`✓ Tersimpan: bangun ${hariTanggal(isian.tanggalBangun)}`);
      setIsian(null);
    });
  }

  const kolom = "rounded-xl bg-white/10 px-3 py-3 text-base text-slate-100";

  return (
    <section className="space-y-3 rounded-2xl border border-indigo-300/15 bg-indigo-400/[0.06] p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium">😴 Tidur semalam</p>
        {hariIni ? (
          <span className={`rounded-full px-2.5 py-1 text-xs ${WARNA[nilaiTidur(hariIni.durasiMenit).level]}`}>
            {fmtDurasi(hariIni.durasiMenit)} · {nilaiTidur(hariIni.durasiMenit).label}
          </span>
        ) : (
          <span className="text-xs text-slate-400">belum dicatat</span>
        )}
      </div>

      {info && <p className="text-sm text-emerald-300">{info}</p>}

      {!isian && (
        <div className="space-y-1.5 text-sm">
          {hariIni && (
            <>
              <p className="text-slate-200">
                Tidur <b>{hariIni.jamTidur}</b> ({namaHari(hariIni.tanggalTidur)}) → bangun <b>{hariIni.jamBangun}</b> ({namaHari(hariIni.tanggalBangun)})
                {hariIni.kualitas ? ` · ${KUALITAS[hariIni.kualitas - 1].emoji} ${KUALITAS[hariIni.kualitas - 1].label}` : ""}
              </p>
              {hariIni.catatan && <p className="text-slate-400">“{hariIni.catatan}”</p>}
              {nilaiTidur(hariIni.durasiMenit).level !== "cukup" && (
                <p className="text-xs text-slate-500">Target tidur ±{targetJam} jam. Kurang tidur bikin pemulihan otot dan tenaga di gym turun.</p>
              )}
            </>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            {hariIni && (
              <>
                <button onClick={() => buka(isianDari(hariIni))} className="rounded-xl bg-white/10 px-4 py-2 text-sm active:bg-white/20">
                  Ubah
                </button>
                <button
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const r = await hapusTidurApp(hariIni.tanggalBangun);
                      if (!r.ok) setError(r.error);
                      else setInfo(null);
                    })
                  }
                  className="rounded-xl bg-white/5 px-4 py-2 text-sm text-slate-400 disabled:opacity-60"
                >
                  Hapus
                </button>
              </>
            )}
            <button onClick={() => buka(isianBaru())} className="rounded-xl bg-white/10 px-4 py-2 text-sm active:bg-white/20">
              {hariIni ? "➕ Catat hari lain" : "➕ Catat tidur"}
            </button>
          </div>
          {error && <p className="text-sm text-red-300">{error}</p>}
        </div>
      )}

      {isian && (
        <div className="space-y-3">
          <fieldset className="space-y-1">
            <legend className="mb-1 text-xs text-slate-300">
              🌙 Mulai tidur · <b>{hariTanggal(isian.tanggalTidur)}</b>
            </legend>
            <div className="grid grid-cols-[3fr_2fr] gap-3">
              <div className="min-w-0">
                <input type="date" aria-label="Tanggal mulai tidur" max={today} value={isian.tanggalTidur} onChange={(e) => ubah({ tanggalTidur: e.target.value, manual: true })} className={kolom} />
              </div>
              <div className="min-w-0">
                <input type="time" aria-label="Jam mulai tidur" value={isian.jamTidur} onChange={(e) => ubah({ jamTidur: e.target.value })} className={kolom} />
              </div>
            </div>
          </fieldset>

          <fieldset className="space-y-1">
            <legend className="mb-1 text-xs text-slate-300">
              ☀️ Bangun · <b>{hariTanggal(isian.tanggalBangun)}</b>
            </legend>
            <div className="grid grid-cols-[3fr_2fr] gap-3">
              <div className="min-w-0">
                <input type="date" aria-label="Tanggal bangun" max={today} value={isian.tanggalBangun} onChange={(e) => ubah({ tanggalBangun: e.target.value })} className={kolom} />
              </div>
              <div className="min-w-0">
                <input type="time" aria-label="Jam bangun" value={isian.jamBangun} onChange={(e) => ubah({ jamBangun: e.target.value })} className={kolom} />
              </div>
            </div>
          </fieldset>

          {/* Pratinjau langsung, biar ketahuan kalau tanggalnya salah sebelum disimpan */}
          {cek?.ok ? (
            <p className={`rounded-xl px-3 py-2 text-sm ${WARNA[nilaiTidur(cek.waktu.durasiMenit).level]}`}>
              Durasi: <b>{fmtDurasi(cek.waktu.durasiMenit)}</b> · {nilaiTidur(cek.waktu.durasiMenit).label}
            </p>
          ) : (
            <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-100">{cek?.error}</p>
          )}
          {tertimpa && (
            <p className="text-xs text-amber-200">
              Tanggal bangun ini udah ada catatannya ({tertimpa.jamTidur} → {tertimpa.jamBangun}). Kalau disimpan, yang lama ditimpa.
            </p>
          )}

          <div>
            <p className="mb-1.5 text-xs text-slate-400">Tidurnya gimana? (boleh dilewati)</p>
            <div className="grid grid-cols-5 gap-1.5">
              {KUALITAS.map((k) => (
                <button
                  key={k.n}
                  onClick={() => ubah({ kualitas: isian.kualitas === k.n ? null : k.n })}
                  className={`rounded-xl py-2 text-center ${isian.kualitas === k.n ? "bg-indigo-400/30 ring-1 ring-indigo-300/60" : "bg-white/10"}`}
                >
                  <span className="block text-xl">{k.emoji}</span>
                  <span className="block text-[10px] text-slate-300">{k.label}</span>
                </button>
              ))}
            </div>
          </div>

          <textarea
            value={isian.catatan}
            onChange={(e) => ubah({ catatan: e.target.value })}
            rows={2}
            maxLength={300}
            placeholder="Cerita dikit: nyenyak nggak? kebangun? susah tidur?"
            className="w-full resize-none rounded-xl bg-white/10 px-3 py-2 text-base placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-300/50"
          />

          {error && <p className="text-sm text-red-300">{error}</p>}
          <div className="flex gap-2">
            <button
              disabled={pending || !cek?.ok}
              onClick={simpan}
              className="flex-1 rounded-xl bg-indigo-400 py-3 font-semibold text-indigo-950 active:scale-[0.98] disabled:opacity-60"
            >
              {pending ? "Menyimpan…" : "Simpan tidur"}
            </button>
            <button onClick={() => setIsian(null)} className="rounded-xl bg-white/10 px-4 text-sm">
              Batal
            </button>
          </div>
        </div>
      )}

      {daftar.length > 0 && (
        <div className="border-t border-white/5 pt-3">
          <p className="mb-1.5 text-[11px] text-slate-500">Tap buat ubah (tanggal = hari bangun)</p>
          <div className="flex flex-wrap gap-1.5">
            {daftar.slice(0, 7).reverse().map((t) => (
              <button key={t.tanggalBangun} onClick={() => buka(isianDari(t))} className={`rounded-lg px-2 py-1 text-xs ${WARNA[nilaiTidur(t.durasiMenit).level]}`}>
                {namaHari(t.tanggalBangun).slice(0, 3)} {parseInt(t.tanggalBangun.slice(8, 10), 10)} · {durasiPendek(t.durasiMenit)}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
