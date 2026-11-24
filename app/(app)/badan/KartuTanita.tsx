"use client";

import { useRef, useState, useTransition } from "react";
import type { Kondisi } from "@/lib/body/db.ts";
import type { KomposisiBaca } from "@/lib/body/tanitaValid.ts";
import { PILIHAN } from "./FormTimbang.tsx";
import { bacaTanitaApp, simpanTanitaApp } from "./tanitaActions.ts";

const KOLOM: { kunci: keyof KomposisiBaca; label: string; satuan: string }[] = [
  { kunci: "beratKg", label: "Berat", satuan: "kg" },
  { kunci: "bodyFatPct", label: "Body fat", satuan: "%" },
  { kunci: "muscleMassKg", label: "Massa otot", satuan: "kg" },
  { kunci: "muscleScore", label: "Muscle score", satuan: "" },
  { kunci: "bmi", label: "BMI", satuan: "" },
  { kunci: "muscleQuality", label: "Muscle quality", satuan: "" },
  { kunci: "visceralFat", label: "Visceral fat", satuan: "" },
  { kunci: "boneMassKg", label: "Massa tulang", satuan: "kg" },
  { kunci: "bodyWaterPct", label: "Body water", satuan: "%" },
  { kunci: "bmrKcal", label: "BMR", satuan: "kcal" },
  { kunci: "metabolicAge", label: "Usia metabolik", satuan: "" },
];

/** Perkecil foto di browser (maks 1600 px, JPEG) supaya cepat diunggah dan di bawah batas ukuran. */
async function perkecil(file: File): Promise<File> {
  const bmp = await createImageBitmap(file);
  const skala = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const kanvas = document.createElement("canvas");
  kanvas.width = Math.round(bmp.width * skala);
  kanvas.height = Math.round(bmp.height * skala);
  kanvas.getContext("2d")!.drawImage(bmp, 0, 0, kanvas.width, kanvas.height);
  const blob = await new Promise<Blob | null>((r) => kanvas.toBlob(r, "image/jpeg", 0.85));
  if (!blob) throw new Error("Gagal memperkecil foto");
  return new File([blob], "tanita.jpg", { type: "image/jpeg" });
}

type Tahap = "diam" | "membaca" | "periksa";

export function KartuTanita() {
  const input = useRef<HTMLInputElement>(null);
  const [tahap, setTahap] = useState<Tahap>("diam");
  const [data, setData] = useState<KomposisiBaca | null>(null);
  const [masalah, setMasalah] = useState<string[]>([]);
  const [peringatan, setPeringatan] = useState<string[]>([]);
  const [catatan, setCatatan] = useState("");
  const [kondisi, setKondisi] = useState<Kondisi>("sebelum_latihan");
  const [pesan, setPesan] = useState<{ jenis: "error" | "ok"; teks: string } | null>(null);
  const [pending, start] = useTransition();

  async function pilihFoto(file: File | undefined) {
    if (!file) return;
    setPesan(null);
    setTahap("membaca");
    try {
      const kecil = await perkecil(file);
      const fd = new FormData();
      fd.set("foto", kecil);
      const r = await bacaTanitaApp(fd);
      if (!r.ok) {
        setPesan({ jenis: "error", teks: r.error });
        setTahap("diam");
        return;
      }
      setData(r.data);
      setMasalah(r.masalah);
      setPeringatan(r.peringatan);
      setCatatan(r.catatan);
      setTahap("periksa");
    } catch {
      setPesan({ jenis: "error", teks: "Gagal memproses foto. Coba foto lain." });
      setTahap("diam");
    } finally {
      if (input.current) input.current.value = "";
    }
  }

  function ubah(k: keyof KomposisiBaca, teks: string) {
    setData((d) => (d ? { ...d, [k]: teks.trim() === "" ? null : Number(teks.replace(",", ".")) } : d));
  }

  function simpan() {
    if (!data) return;
    setPesan(null);
    start(async () => {
      const r = await simpanTanitaApp({ data, kondisi });
      if (!r.ok) {
        setPesan({ jenis: "error", teks: r.error });
        return;
      }
      setPesan({ jenis: "ok", teks: r.duplikat ? "Timbangan di waktu yang sama sudah tercatat, jadi nggak disimpan dobel." : "✅ Tersimpan. Grafik dan komposisi di bawah sudah diperbarui." });
      setTahap("diam");
      setData(null);
    });
  }

  return (
    <section className="space-y-3 rounded-2xl border border-white/5 bg-white/[0.04] p-4">
      <p className="font-medium">📷 Baca dari foto layar Tanita</p>

      {tahap === "diam" && (
        <>
          <p className="text-xs text-slate-400">Pilih screenshot atau foto halaman &quot;Body Comp&quot; di app Tanita. Semua angka dibaca otomatis (termasuk koreksi pergeseran baris) dan lo cek dulu sebelum disimpan.</p>
          <input ref={input} type="file" accept="image/*" onChange={(e) => pilihFoto(e.target.files?.[0])} className="hidden" id="foto-tanita" />
          <label htmlFor="foto-tanita" className="block cursor-pointer rounded-xl bg-white/10 px-4 py-3.5 text-center font-medium active:bg-white/20">
            Pilih foto
          </label>
        </>
      )}

      {tahap === "membaca" && <p className="animate-pulse py-4 text-center text-sm text-slate-300">Lagi baca layar Tanita…</p>}

      {tahap === "periksa" && data && (
        <div className="space-y-3">
          {data.tanggal && (
            <p className="text-xs text-slate-400">
              Waktu di layar: {data.tanggal}
              {data.jam ? ` ${data.jam}` : ""}
            </p>
          )}
          {masalah.length > 0 && (
            <div className="rounded-xl bg-red-500/10 p-3 text-sm text-red-200">
              <p className="mb-1 font-medium">Ada angka yang mencurigakan, koreksi dulu:</p>
              <ul className="list-disc space-y-0.5 pl-5">
                {masalah.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          )}
          {peringatan.length > 0 && <p className="rounded-xl bg-amber-400/10 p-3 text-xs text-amber-100">{peringatan.join(" ")}</p>}
          {catatan && <p className="text-xs text-slate-500">Catatan pembaca: {catatan}</p>}

          <div className="grid grid-cols-2 gap-2">
            {KOLOM.map((k) => (
              <label key={k.kunci} className="block text-xs text-slate-400">
                {k.label} {k.satuan && `(${k.satuan})`}
                <input
                  inputMode="decimal"
                  value={(data[k.kunci] as number | null) ?? ""}
                  onChange={(e) => ubah(k.kunci, e.target.value)}
                  className="mt-1 w-full rounded-xl bg-black/30 px-3 py-2.5 text-base text-slate-100 outline-none ring-1 ring-white/10 focus:ring-emerald-400/60"
                />
              </label>
            ))}
          </div>

          <fieldset className="space-y-2">
            <legend className="mb-1 text-xs text-slate-400">Kondisi timbang</legend>
            {PILIHAN.map((p) => (
              <label key={p.nilai} className={`flex cursor-pointer items-center gap-3 rounded-xl p-3 text-sm ${kondisi === p.nilai ? "bg-emerald-500/15 ring-1 ring-emerald-400/40" : "bg-white/5"}`}>
                <input type="radio" name="kondisi-tanita" checked={kondisi === p.nilai} onChange={() => setKondisi(p.nilai)} className="h-5 w-5 accent-emerald-500" />
                {p.judul}
              </label>
            ))}
          </fieldset>

          <div className="grid grid-cols-2 gap-2">
            <button disabled={pending} onClick={simpan} className="rounded-xl bg-emerald-500 py-3.5 font-semibold text-emerald-950 active:scale-[0.98] disabled:opacity-60">
              {pending ? "Menyimpan…" : "✅ Simpan"}
            </button>
            <button
              onClick={() => {
                setTahap("diam");
                setData(null);
              }}
              className="rounded-xl bg-white/10 py-3.5"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {pesan && <p className={`rounded-xl px-3 py-2.5 text-sm ${pesan.jenis === "error" ? "bg-red-500/10 text-red-200" : "bg-emerald-500/10 text-emerald-200"}`}>{pesan.teks}</p>}
    </section>
  );
}
