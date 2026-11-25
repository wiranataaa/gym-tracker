"use client";

import { useRef, useState } from "react";
import { SUDUT, type Sudut } from "@/lib/foto/hitung.ts";
import { perkecilFoto } from "../_components/perkecilFoto.ts";
import { hapusFotoProgres, unggahFotoProgres } from "./fotoActions.ts";

export type FotoView = { id: number; url: string };
export type GrupView = { tanggal: string; tglTeks: string; beratTeks: string | null; foto: Partial<Record<Sudut, FotoView>> };
export type BandingView = {
  awal: { tglTeks: string; url: string; beratTeks: string | null };
  terbaru: { tglTeks: string; url: string; beratTeks: string | null };
  ringkas: string;
};

const LABEL: Record<Sudut, string> = { depan: "Depan", samping: "Samping", belakang: "Belakang" };

/** Foto progres: ambil foto 3 sudut, bandingkan awal vs terbaru, dan riwayatnya. */
export function KartuFoto({
  grup,
  banding,
  sudahHariIni,
  hariSejak,
}: {
  grup: GrupView[];
  banding: Record<Sudut, BandingView | null>;
  sudahHariIni: Sudut[];
  hariSejak: number | null;
}) {
  const input = useRef<HTMLInputElement>(null);
  const sudutAktif = useRef<Sudut>("depan");
  const [sibuk, setSibuk] = useState<Sudut | null>(null);
  const [pesan, setPesan] = useState<{ jenis: "error" | "ok"; teks: string } | null>(null);
  const [tab, setTab] = useState<Sudut>(() => SUDUT.find((s) => banding[s.nilai])?.nilai ?? "depan");
  const [besar, setBesar] = useState<{ id: number; url: string; judul: string } | null>(null);
  const [konfirmasiHapus, setKonfirmasiHapus] = useState(false);

  function pilih(s: Sudut) {
    sudutAktif.current = s;
    setPesan(null);
    input.current?.click();
  }

  async function terpilih(file: File | undefined) {
    if (!file) return;
    const s = sudutAktif.current;
    setSibuk(s);
    try {
      const kecil = await perkecilFoto(file, 1400, `${s}.jpg`);
      const fd = new FormData();
      fd.set("foto", kecil);
      fd.set("sudut", s);
      const r = await unggahFotoProgres(fd);
      setPesan(r.ok ? { jenis: "ok", teks: `✅ Foto ${LABEL[s].toLowerCase()} tersimpan.` } : { jenis: "error", teks: r.error });
    } catch {
      setPesan({ jenis: "error", teks: "Gagal memproses foto. Coba foto lain." });
    } finally {
      setSibuk(null);
      if (input.current) input.current.value = "";
    }
  }

  async function hapus() {
    if (!besar) return;
    const r = await hapusFotoProgres(besar.id);
    setBesar(null);
    setKonfirmasiHapus(false);
    setPesan(r.ok ? { jenis: "ok", teks: "Foto dihapus." } : { jenis: "error", teks: r.error });
  }

  const b = banding[tab];
  const adaBanding = SUDUT.some((s) => banding[s.nilai]);

  return (
    <section className="space-y-3 rounded-2xl border border-white/5 bg-white/[0.04] p-4">
      <div className="flex items-baseline justify-between">
        <p className="font-medium">📸 Foto progres</p>
        <p className="text-xs text-slate-400">{hariSejak == null ? "belum ada foto" : hariSejak === 0 ? "terakhir: hari ini" : `terakhir ${hariSejak} hari lalu`}</p>
      </div>

      <p className="text-xs text-slate-400">
        Sekali sebulan cukup. Pagi sebelum latihan, cahaya dan jarak kamera sama tiap kali, pose rileks. Foto tersimpan privat, cuma lo yang bisa lihat.
      </p>

      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => terpilih(e.target.files?.[0])} />
      <div className="grid grid-cols-3 gap-2">
        {SUDUT.map((s) => {
          const sudah = sudahHariIni.includes(s.nilai);
          return (
            <button
              key={s.nilai}
              disabled={sibuk != null}
              onClick={() => pilih(s.nilai)}
              className={`rounded-xl px-2 py-3.5 text-sm font-medium active:scale-[0.98] disabled:opacity-60 ${sudah ? "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/30" : "bg-white/10"}`}
            >
              {sibuk === s.nilai ? "Mengunggah…" : `${sudah ? "✓ " : "📷 "}${s.label}`}
            </button>
          );
        })}
      </div>

      {pesan && <p className={`rounded-xl px-3 py-2.5 text-sm ${pesan.jenis === "error" ? "bg-red-500/10 text-red-200" : "bg-emerald-500/10 text-emerald-200"}`}>{pesan.teks}</p>}

      {adaBanding && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-slate-300">Awal vs terbaru</p>
            <div className="ml-auto flex gap-1">
              {SUDUT.filter((s) => banding[s.nilai]).map((s) => (
                <button key={s.nilai} onClick={() => setTab(s.nilai)} className={`rounded-full px-3 py-1 text-xs ${tab === s.nilai ? "bg-emerald-500 font-semibold text-emerald-950" : "bg-white/10"}`}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          {b && (
            <>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { k: "Awal", d: b.awal },
                  { k: "Terbaru", d: b.terbaru },
                ].map(({ k, d }) => (
                  <button key={k} onClick={() => setBesar({ id: -1, url: d.url, judul: `${LABEL[tab]} · ${d.tglTeks}` })} className="text-left">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={d.url} alt={`${k} ${LABEL[tab]}`} loading="lazy" className="aspect-[3/4] w-full rounded-xl bg-black/30 object-cover" />
                    <p className="mt-1 text-xs text-slate-300">
                      {k}: {d.tglTeks}
                      {d.beratTeks ? ` · ${d.beratTeks}` : ""}
                    </p>
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-400">{b.ringkas}</p>
            </>
          )}
        </div>
      )}

      {grup.length > 0 && (
        <details className="pt-1">
          <summary className="cursor-pointer text-sm font-medium text-slate-300">Semua foto ({grup.length} sesi foto)</summary>
          <div className="mt-3 space-y-4">
            {grup.map((g) => (
              <div key={g.tanggal}>
                <p className="mb-1.5 text-xs text-slate-400">
                  {g.tglTeks}
                  {g.beratTeks ? ` · ${g.beratTeks}` : ""}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {SUDUT.map((s) => {
                    const f = g.foto[s.nilai];
                    return f ? (
                      <button key={s.nilai} onClick={() => { setKonfirmasiHapus(false); setBesar({ id: f.id, url: f.url, judul: `${s.label} · ${g.tglTeks}` }); }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={f.url} alt={`${s.label} ${g.tglTeks}`} loading="lazy" className="aspect-[3/4] w-full rounded-lg bg-black/30 object-cover" />
                      </button>
                    ) : (
                      <div key={s.nilai} className="flex aspect-[3/4] items-center justify-center rounded-lg bg-white/[0.03] text-[11px] text-slate-600">{s.label}</div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      {besar && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/95 p-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-slate-300">{besar.judul}</p>
            <button onClick={() => { setBesar(null); setKonfirmasiHapus(false); }} className="rounded-lg bg-white/10 px-4 py-2 text-sm">Tutup</button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={besar.url} alt={besar.judul} className="min-h-0 flex-1 rounded-xl object-contain" />
          {besar.id > 0 && (
            <div className="mt-3 pb-[env(safe-area-inset-bottom)]">
              {konfirmasiHapus ? (
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={hapus} className="rounded-xl bg-red-500 py-3 font-semibold text-white">Ya, hapus</button>
                  <button onClick={() => setKonfirmasiHapus(false)} className="rounded-xl bg-white/10 py-3">Batal</button>
                </div>
              ) : (
                <button onClick={() => setKonfirmasiHapus(true)} className="w-full rounded-xl bg-white/10 py-3 text-sm text-red-300">🗑 Hapus foto ini</button>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
