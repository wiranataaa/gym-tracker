"use client";

import { Fragment, useState, useTransition } from "react";
import type { Tidur, TidurAktif } from "@/lib/tidur/db.ts";
import { cariBentrok, fmtDurasi, jamWIB, nilaiTidur, ringkasHari, susunWaktuTidurTanggal, tebakTanggalTidur, totalPerHari } from "@/lib/tidur/hitung.ts";
import { namaHari, tglSingkat, todayWIB } from "@/lib/time.ts";
import { hapusTidurApp, mulaiTidurApp, simpanTidurApp, ubahMulaiTidurApp } from "../actions.ts";

const KUALITAS = [
  { n: 1, emoji: "😫", label: "Parah" },
  { n: 2, emoji: "😕", label: "Gelisah" },
  { n: 3, emoji: "😐", label: "Biasa" },
  { n: 4, emoji: "🙂", label: "Nyenyak" },
  { n: 5, emoji: "😴", label: "Pulas" },
];

const WARNA = { kurang: "bg-red-500/20 text-red-200", pas: "bg-amber-500/20 text-amber-200", cukup: "bg-emerald-500/20 text-emerald-200" };
const BARIS_AWAL = 6;

const hariTanggal = (d: string) => (d ? `${namaHari(d)}, ${tglSingkat(d)}` : "pilih tanggal");
const hariPendek = (d: string) => `${namaHari(d).slice(0, 3)} ${parseInt(d.slice(8, 10), 10)}`;
const durasiPendek = (menit: number) => fmtDurasi(menit).replace(" jam ", "j ").replace(" menit", "m").replace(" jam", "j");

type Props = {
  /** tanggal hari ini (WIB) */
  today: string;
  /** tidur yang sudah ditutup, 14 hari terakhir, terbaru dulu */
  daftar: Tidur[];
  /** tidur yang masih jalan (sudah "mau tidur", belum "udah bangun") */
  aktif: TidurAktif | null;
  /** jam tidur & bangun terakhir, buat isi awal catatan manual */
  awal: { jamTidur: string; jamBangun: string };
  targetJam: number;
};

type Lengkap = {
  jenis: "bangun" | "ubah" | "manual";
  /** baris yang diubah; null = catatan baru */
  id: number | null;
  tanggalTidur: string;
  jamTidur: string;
  tanggalBangun: string;
  jamBangun: string;
  /** tanggal tidur sudah pasti / diubah sendiri, jadi jangan ditebak ulang */
  manual: boolean;
  kualitas: number | null;
  catatan: string;
};
type Mulai = { jenis: "mulai"; id: number; tanggalTidur: string; jamTidur: string };
type Form = Lengkap | Mulai | null;

const kolom = "rounded-xl bg-white/10 px-3 py-3 text-base text-slate-100";

/** Sepasang input tanggal + jam dengan nama harinya. */
function TanggalJam({ judul, tanggal, jam, maks, onTanggal, onJam }: { judul: string; tanggal: string; jam: string; maks?: string; onTanggal: (v: string) => void; onJam: (v: string) => void }) {
  return (
    <fieldset className="space-y-1">
      <legend className="mb-1 text-xs text-slate-300">
        {judul} · <b>{hariTanggal(tanggal)}</b>
      </legend>
      <div className="grid grid-cols-[3fr_2fr] gap-3">
        <div className="min-w-0">
          <input type="date" aria-label={`Tanggal ${judul}`} max={maks} value={tanggal} onChange={(e) => onTanggal(e.target.value)} className={kolom} />
        </div>
        <div className="min-w-0">
          <input type="time" aria-label={`Jam ${judul}`} value={jam} onChange={(e) => onJam(e.target.value)} className={kolom} />
        </div>
      </div>
    </fieldset>
  );
}

// Tidur: dua langkah ("mau tidur" lalu "udah bangun"), atau catat manual. Tiap tidur satu baris di tabel,
// jadi tidur dua kali di tanggal yang sama nggak saling menimpa.
export function PanelTidur({ today, daftar, aktif, awal, targetJam }: Props) {
  const [form, setForm] = useState<Form>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [yakinHapus, setYakinHapus] = useState(false);
  const [semua, setSemua] = useState(false);
  const [pending, start] = useTransition();

  const hariIni = ringkasHari(daftar.filter((t) => t.tanggalBangun === today));
  const perHari = totalPerHari(daftar);
  const baris = semua ? daftar : daftar.slice(0, BARIS_AWAL);

  function buka(f: Form) {
    setError(null);
    setInfo(null);
    setYakinHapus(false);
    setForm(f);
  }

  function jalan(fn: () => Promise<{ ok: boolean; error?: string }>, pesan: string | null) {
    setError(null);
    setInfo(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) {
        setError(r.error ?? "Gagal");
        return;
      }
      setForm(null);
      setInfo(pesan);
    });
  }

  function bukaBangun(a: TidurAktif) {
    const now = new Date();
    buka({ jenis: "bangun", id: a.id, tanggalTidur: a.tanggalTidur, jamTidur: a.jamTidur, tanggalBangun: todayWIB(now), jamBangun: jamWIB(now.toISOString()), manual: true, kualitas: null, catatan: "" });
  }

  function bukaManual() {
    buka({
      jenis: "manual",
      id: null,
      tanggalBangun: today,
      jamBangun: awal.jamBangun,
      tanggalTidur: tebakTanggalTidur(today, awal.jamTidur, awal.jamBangun),
      jamTidur: awal.jamTidur,
      manual: false,
      kualitas: null,
      catatan: "",
    });
  }

  function bukaUbah(t: Tidur) {
    buka({ jenis: "ubah", id: t.id, tanggalTidur: t.tanggalTidur, jamTidur: t.jamTidur, tanggalBangun: t.tanggalBangun, jamBangun: t.jamBangun, manual: true, kualitas: t.kualitas, catatan: t.catatan ?? "" });
  }

  /** Ubah isian; tanggal tidur ikut ditebak ulang selama belum dipastikan. */
  function ubah(patch: Partial<Lengkap>) {
    setForm((p) => {
      if (!p || p.jenis === "mulai") return p;
      const n = { ...p, ...patch };
      if (!n.manual && n.tanggalBangun) n.tanggalTidur = tebakTanggalTidur(n.tanggalBangun, n.jamTidur, n.jamBangun);
      return n;
    });
  }

  const lengkap = form && form.jenis !== "mulai" ? form : null;
  const cek = lengkap ? susunWaktuTidurTanggal(lengkap) : null;
  const bentrok = lengkap && cek?.ok ? cariBentrok(daftar, cek.waktu.sleptAt, cek.waktu.wokeAt, lengkap.id) : null;
  const belumBangun = !!cek && !cek.ok && cek.error.includes("belum kejadian");

  const tombolUtama = "w-full rounded-2xl py-4 text-base font-semibold active:scale-[0.98] disabled:opacity-60";

  return (
    <section className="space-y-3 rounded-2xl border border-indigo-300/15 bg-indigo-400/[0.06] p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium">😴 Tidur</p>
        {aktif ? (
          <span className="rounded-full bg-indigo-400/25 px-2.5 py-1 text-xs text-indigo-100">💤 lagi dicatat</span>
        ) : hariIni ? (
          <span className={`rounded-full px-2.5 py-1 text-xs ${WARNA[nilaiTidur(hariIni.totalMenit).level]}`}>
            {fmtDurasi(hariIni.totalMenit)} · {nilaiTidur(hariIni.totalMenit).label}
          </span>
        ) : (
          <span className="text-xs text-slate-400">belum dicatat</span>
        )}
      </div>

      {info && <p className="text-sm text-emerald-300">{info}</p>}

      {!form && (
        <div className="space-y-2">
          {aktif ? (
            <>
              <p className="rounded-xl bg-white/5 px-3 py-2.5 text-sm text-slate-200">
                Mulai tidur <b>{aktif.jamTidur}</b> · {hariTanggal(aktif.tanggalTidur)}
              </p>
              {aktif.kelamaan && <p className="text-xs text-amber-200">Udah lebih dari 16 jam. Kayaknya lupa tap bangun: isi jam bangun yang benar.</p>}
              <button disabled={pending} onClick={() => bukaBangun(aktif)} className={`${tombolUtama} bg-amber-300 text-amber-950`}>
                ☀️ Gua udah bangun
              </button>
              <div className="flex gap-2">
                <button onClick={() => buka({ jenis: "mulai", id: aktif.id, tanggalTidur: aktif.tanggalTidur, jamTidur: aktif.jamTidur })} className="flex-1 rounded-xl bg-white/10 py-2.5 text-sm">
                  ✏️ Ubah jam tidur
                </button>
                <button disabled={pending} onClick={() => jalan(() => hapusTidurApp(aktif.id), "Dibatalin.")} className="flex-1 rounded-xl bg-white/5 py-2.5 text-sm text-slate-400 disabled:opacity-60">
                  Batalin
                </button>
              </div>
            </>
          ) : (
            <>
              <button disabled={pending} onClick={() => jalan(() => mulaiTidurApp(), "🌙 Dicatat. Besok pas bangun, tap “Gua udah bangun”.")} className={`${tombolUtama} bg-indigo-400 text-indigo-950`}>
                {pending ? "Sebentar…" : "🌙 Gua mau tidur sekarang"}
              </button>
              <button onClick={bukaManual} className="w-full rounded-xl bg-white/10 py-2.5 text-sm">
                ➕ Catat manual (tidur yang udah lewat)
              </button>
            </>
          )}
          {error && <p className="text-sm text-red-300">{error}</p>}
        </div>
      )}

      {form?.jenis === "mulai" && (
        <div className="space-y-3">
          <TanggalJam judul="🌙 Mulai tidur" tanggal={form.tanggalTidur} jam={form.jamTidur} onTanggal={(v) => setForm({ ...form, tanggalTidur: v })} onJam={(v) => setForm({ ...form, jamTidur: v })} />
          {error && <p className="text-sm text-red-300">{error}</p>}
          <div className="flex gap-2">
            <button disabled={pending} onClick={() => jalan(() => ubahMulaiTidurApp(form.id, form.tanggalTidur, form.jamTidur), "✓ Jam tidur diubah.")} className="flex-1 rounded-xl bg-indigo-400 py-3 font-semibold text-indigo-950 disabled:opacity-60">
              Simpan
            </button>
            <button onClick={() => buka(null)} className="rounded-xl bg-white/10 px-4 text-sm">
              Batal
            </button>
          </div>
        </div>
      )}

      {lengkap && (
        <div className="space-y-3 rounded-xl bg-white/[0.03] p-3">
          <p className="text-sm font-medium">{lengkap.jenis === "bangun" ? "☀️ Pagi! Cek jamnya" : lengkap.jenis === "ubah" ? "✏️ Ubah catatan tidur" : "➕ Catat manual"}</p>
          <TanggalJam judul="🌙 Mulai tidur" tanggal={lengkap.tanggalTidur} jam={lengkap.jamTidur} maks={today} onTanggal={(v) => ubah({ tanggalTidur: v, manual: true })} onJam={(v) => ubah({ jamTidur: v })} />
          <TanggalJam judul="☀️ Bangun" tanggal={lengkap.tanggalBangun} jam={lengkap.jamBangun} onTanggal={(v) => ubah({ tanggalBangun: v })} onJam={(v) => ubah({ jamBangun: v })} />

          {/* Pratinjau langsung, biar ketahuan kalau salah sebelum disimpan */}
          {bentrok ? (
            <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
              Tumpang tindih sama catatan {hariPendek(bentrok.tanggalTidur)} {bentrok.jamTidur} → {bentrok.jamBangun}. Kalau mau ngubah yang itu, tap barisnya di tabel.
            </p>
          ) : cek?.ok ? (
            <p className={`rounded-xl px-3 py-2 text-sm ${WARNA[nilaiTidur(cek.waktu.durasiMenit).level]}`}>
              Durasi: <b>{fmtDurasi(cek.waktu.durasiMenit)}</b>
            </p>
          ) : (
            <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-100">{cek?.error}</p>
          )}

          {/* Waktu bangun masih di depan = sebenarnya baru mau tidur */}
          {belumBangun && lengkap.jenis === "manual" && !aktif && (
            <button
              disabled={pending}
              onClick={() => jalan(() => mulaiTidurApp({ tanggal: lengkap.tanggalTidur, jam: lengkap.jamTidur }), "🌙 Jam tidurnya dicatat. Pas bangun, tap “Gua udah bangun”.")}
              className="w-full rounded-xl bg-indigo-400 py-3 text-sm font-semibold text-indigo-950 disabled:opacity-60"
            >
              🌙 Belum bangun? Simpan jam tidurnya dulu
            </button>
          )}

          <div>
            <p className="mb-1.5 text-xs text-slate-400">Tidurnya gimana? (boleh dilewati)</p>
            <div className="grid grid-cols-5 gap-1.5">
              {KUALITAS.map((k) => (
                <button
                  key={k.n}
                  onClick={() => ubah({ kualitas: lengkap.kualitas === k.n ? null : k.n })}
                  className={`rounded-xl py-2 text-center ${lengkap.kualitas === k.n ? "bg-indigo-400/30 ring-1 ring-indigo-300/60" : "bg-white/10"}`}
                >
                  <span className="block text-xl">{k.emoji}</span>
                  <span className="block text-[10px] text-slate-300">{k.label}</span>
                </button>
              ))}
            </div>
          </div>

          <textarea
            value={lengkap.catatan}
            onChange={(e) => ubah({ catatan: e.target.value })}
            rows={2}
            maxLength={300}
            placeholder="Cerita dikit: nyenyak nggak? kebangun? susah tidur?"
            className="w-full resize-none rounded-xl bg-white/10 px-3 py-2 text-base placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-300/50"
          />

          {error && <p className="text-sm text-red-300">{error}</p>}
          <div className="flex gap-2">
            <button
              disabled={pending || !cek?.ok || !!bentrok}
              onClick={() => jalan(() => simpanTidurApp(lengkap), `✓ Tersimpan: bangun ${hariTanggal(lengkap.tanggalBangun)}`)}
              className="flex-1 rounded-xl bg-indigo-400 py-3 font-semibold text-indigo-950 active:scale-[0.98] disabled:opacity-60"
            >
              {pending ? "Menyimpan…" : "Simpan tidur"}
            </button>
            <button onClick={() => buka(null)} className="rounded-xl bg-white/10 px-4 text-sm">
              Batal
            </button>
          </div>

          {lengkap.jenis === "ubah" &&
            (yakinHapus ? (
              <div className="grid grid-cols-2 gap-2">
                <button disabled={pending} onClick={() => jalan(() => hapusTidurApp(lengkap.id!), "Catatan dihapus.")} className="rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                  Ya, hapus
                </button>
                <button onClick={() => setYakinHapus(false)} className="rounded-xl bg-white/10 py-2.5 text-sm">
                  Nggak jadi
                </button>
              </div>
            ) : (
              <button onClick={() => setYakinHapus(true)} className="w-full rounded-xl py-2 text-sm text-red-300">
                🗑 Hapus catatan ini
              </button>
            ))}
        </div>
      )}

      {daftar.length > 0 && (
        <div className="border-t border-white/5 pt-3">
          <p className="mb-2 text-xs font-medium text-slate-300">📋 Riwayat tidur</p>
          <div className="grid grid-cols-[1fr_1fr_auto] gap-x-2 px-2 pb-1 text-[11px] text-slate-500">
            <span>Tidur</span>
            <span>Bangun</span>
            <span className="w-14 text-right">Lama</span>
          </div>
          <div className="space-y-1">
            {baris.map((t, i) => {
              const terakhirDiHari = daftar[i + 1]?.tanggalBangun !== t.tanggalBangun;
              const lebihDariSekali = daftar.filter((x) => x.tanggalBangun === t.tanggalBangun).length > 1;
              const total = perHari.get(t.tanggalBangun) ?? t.durasiMenit;
              return (
                <Fragment key={t.id}>
                  <button onClick={() => bukaUbah(t)} className="grid w-full grid-cols-[1fr_1fr_auto] items-center gap-x-2 rounded-lg bg-white/5 px-2 py-2 text-left text-xs active:bg-white/15">
                    <span>
                      {hariPendek(t.tanggalTidur)} · <b>{t.jamTidur}</b>
                    </span>
                    <span>
                      {hariPendek(t.tanggalBangun)} · <b>{t.jamBangun}</b>
                    </span>
                    {/* Warna cukup/kurang menilai total sehari, bukan tidur satuan */}
                    <span className={`w-14 rounded-md px-1 py-0.5 text-right ${lebihDariSekali ? "text-slate-300" : WARNA[nilaiTidur(t.durasiMenit).level]}`}>{durasiPendek(t.durasiMenit)}</span>
                  </button>
                  {lebihDariSekali && terakhirDiHari && (
                    <p className={`rounded-lg px-2 py-1 text-right text-xs ${WARNA[nilaiTidur(total).level]}`}>
                      Total bangun {hariPendek(t.tanggalBangun)}: <b>{durasiPendek(total)}</b>
                    </p>
                  )}
                </Fragment>
              );
            })}
          </div>
          {daftar.length > BARIS_AWAL && (
            <button onClick={() => setSemua(!semua)} className="mt-2 w-full text-xs text-slate-400">
              {semua ? "Ringkas lagi" : `Lihat semua (${daftar.length})`}
            </button>
          )}
          <p className="mt-2 text-[11px] text-slate-500">Satu baris = satu kali tidur. Tap baris buat ubah atau hapus. Target ±{targetJam} jam per hari.</p>
        </div>
      )}
    </section>
  );
}
