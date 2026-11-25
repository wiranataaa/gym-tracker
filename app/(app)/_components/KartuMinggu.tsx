import type { StatusHari } from "@/lib/konsistensi/hitung.ts";
import type { Konsistensi } from "@/lib/konsistensi/db.ts";

const TITIK: Record<StatusHari, { kelas: string; isi: string }> = {
  selesai: { kelas: "bg-emerald-500 text-emerald-950 font-bold", isi: "✓" },
  hari_ini: { kelas: "border-2 border-emerald-400 text-emerald-300", isi: "•" },
  lewat: { kelas: "bg-red-500/15 text-red-300/80", isi: "✕" },
  nanti: { kelas: "bg-white/5 text-slate-600", isi: "" },
  sebelum: { kelas: "bg-white/[0.03] text-slate-700", isi: "" },
};

/** Titik Senin-Jumat minggu ini + skor konsistensi + colekan anti-bolos kalau perlu. */
export function KartuMinggu({ data }: { data: Konsistensi }) {
  const { minggu, pagi } = data;
  const penuh = minggu.butuh === 0;

  let status: string;
  if (penuh) status = "Jatah minggu ini penuh. Mantap, sisanya bonus.";
  else if (!minggu.masihBisa) status = `Kurang ${minggu.butuh} sesi, tapi sisa harinya nggak cukup. Tetap latihan: tiap sesi kehitung.`;
  else status = `Kurang ${minggu.butuh} sesi, sisa ${minggu.sisaHari} hari latihan.`;

  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.04] p-4">
      <div className="flex items-baseline justify-between">
        <p className="font-medium">📅 Minggu ini</p>
        <p className="text-sm text-slate-300">
          {minggu.selesai}/{minggu.target} sesi · <span className={penuh ? "text-emerald-300" : ""}>{minggu.skor}%</span>
        </p>
      </div>

      <div className="mt-3 flex justify-between gap-1">
        {minggu.titik.map((t) => (
          <div key={t.tanggal} className="flex flex-1 flex-col items-center gap-1.5">
            <span className={`flex h-9 w-9 items-center justify-center rounded-full text-sm ${TITIK[t.status].kelas}`}>{TITIK[t.status].isi}</span>
            <span className={`text-[11px] ${t.status === "hari_ini" ? "font-semibold text-emerald-300" : "text-slate-400"}`}>{t.label}</span>
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs text-slate-400">{status}</p>

      {pagi.teks && (
        <p className="mt-3 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2.5 text-sm leading-snug text-amber-100">💢 {pagi.teks}</p>
      )}
    </div>
  );
}
