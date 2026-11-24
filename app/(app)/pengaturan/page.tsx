import Link from "next/link";
import { requireOwner } from "@/lib/auth.ts";
import { ambilPengaturan, biayaBulanIni } from "@/lib/pengaturan/db.ts";
import { fmtInt, todayWIB } from "@/lib/time.ts";
import { cekDeload } from "@/lib/report/deloadCek.ts";
import { FormPengaturan } from "./FormPengaturan.tsx";
import { KartuDeload } from "./KartuDeload.tsx";

// Perkiraan kurs buat tampilan saja; biaya aslinya dalam USD di tagihan Anthropic.
const KURS_IDR = 16500;

const EKSPOR = [
  { jenis: "latihan", judul: "🏋️ Riwayat latihan", ket: "Semua set: tanggal, gerakan, beban, reps, RPE" },
  { jenis: "nutrisi", judul: "🍽️ Riwayat makan", ket: "Tiap makan: kalori, protein, karbo, lemak, item" },
  { jenis: "timbangan", judul: "⚖️ Riwayat timbangan", ket: "Berat, body fat, otot, dan kondisi timbang" },
];

export default async function PengaturanPage() {
  await requireOwner();
  const today = todayWIB();
  const [awal, biaya, deload] = await Promise.all([ambilPengaturan(), biayaBulanIni(today), cekDeload(today)]);

  return (
    <div className="space-y-4">
      <div>
        <Link href="/" className="text-sm text-slate-400">
          ← Kembali
        </Link>
        <h1 className="text-2xl font-semibold">Pengaturan</h1>
      </div>

      <KartuDeload aktif={deload.aktif} sampai={deload.sampai} perlu={deload.perlu} alasan={deload.alasan} />

      <FormPengaturan awal={awal} />

      <section className="space-y-3 rounded-2xl border border-white/5 bg-white/[0.04] p-4">
        <p className="font-medium">💸 Biaya AI bulan ini</p>
        <p className="text-2xl font-semibold">
          ${biaya.total.toFixed(3)} <span className="text-base font-normal text-slate-400">≈ Rp {fmtInt(biaya.total * KURS_IDR)}</span>
        </p>
        {biaya.fitur.length === 0 ? (
          <p className="text-sm text-slate-400">Belum ada pemakaian AI bulan ini.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {biaya.fitur.map((f) => (
              <li key={f.fitur} className="flex items-center justify-between gap-3 rounded-xl bg-white/5 px-3 py-2.5">
                <span>
                  {f.label}
                  <span className="block text-xs text-slate-500">
                    {f.panggilan} panggilan · {fmtInt(f.tokenMasuk)} token masuk · {fmtInt(f.tokenKeluar)} keluar
                  </span>
                </span>
                <span className="shrink-0">${f.usd.toFixed(3)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-slate-500">Perkiraan dari jumlah token (kurs kira-kira Rp {fmtInt(KURS_IDR)}/US$). Angka pasti ada di Anthropic Console → Usage.</p>
      </section>

      <section className="space-y-3 rounded-2xl border border-white/5 bg-white/[0.04] p-4">
        <p className="font-medium">📤 Export ke CSV (Google Sheets)</p>
        <p className="text-xs text-slate-400">Unduh, lalu di Google Sheets pilih File → Import → Upload.</p>
        <div className="space-y-2">
          {EKSPOR.map((e) => (
            <a key={e.jenis} href={`/api/export/${e.jenis}`} className="block rounded-xl bg-white/10 px-4 py-3 active:bg-white/20">
              <span className="font-medium">{e.judul}</span>
              <span className="block text-xs text-slate-400">{e.ket}</span>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
