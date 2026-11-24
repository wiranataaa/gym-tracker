import { requireOwner } from "@/lib/auth.ts";
import { getTargets, isStandar, LABEL_KONDISI, listMeasurements } from "@/lib/body/db.ts";
import { dailyValues, movingAverage7, outlook, weeklyRate } from "@/lib/body/trend.ts";
import { laporanTerakhir } from "@/lib/report/mingguan.ts";
import { fmtKg, tglLengkap, tglSingkat, todayWIB } from "@/lib/time.ts";
import { BarisTimbangan } from "./BarisTimbangan.tsx";
import { FormTimbang } from "./FormTimbang.tsx";
import { GrafikBerat } from "./GrafikBerat.tsx";

const SUMBER: Record<string, string> = { manual: "app", telegram: "Telegram", foto_tanita: "foto Tanita" };

export default async function BadanPage() {
  await requireOwner();
  const today = todayWIB();
  const [list, t, laporan] = await Promise.all([listMeasurements(), getTargets(), laporanTerakhir()]);

  const harian = dailyValues(list.map((m) => ({ date: m.date, weightKg: m.weightKg })));
  const rata7 = movingAverage7(harian);
  const rate = weeklyRate(harian, today);
  const o = outlook({ daily: harian, today, targetKg: t.targetKg, targetDate: t.lebaranDate });
  const terakhir = list[0];
  const komposisi = list.find((m) => m.bodyFatPct != null);

  const signed = (n: number) => `${n >= 0 ? "+" : ""}${fmtKg(n)}`;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Badan</h1>

      <FormTimbang awal={terakhir?.weightKg ?? 71} />

      {terakhir && o && (
        <div className="grid grid-cols-3 gap-2 text-center">
          <Kotak judul="Terakhir" nilai={`${fmtKg(terakhir.weightKg)}`} catatan={`kg · ${tglSingkat(terakhir.date)}`} />
          <Kotak judul="Rata-rata 7 hari" nilai={fmtKg(o.currentAvg)} catatan="kg" />
          <Kotak judul="Per minggu" nilai={rate == null ? "-" : signed(rate)} catatan="kg/minggu" />
        </div>
      )}

      {harian.length > 0 && (
        <div className="rounded-2xl border border-white/5 bg-white/[0.04] p-4">
          <p className="mb-2 text-sm font-medium text-slate-300">Grafik berat</p>
          <GrafikBerat harian={harian} rata7={rata7} targetKg={t.targetKg} targetDate={t.lebaranDate} hariIni={today} />
        </div>
      )}

      {o && (
        <div className="rounded-2xl border border-white/5 bg-white/[0.04] p-4 text-sm">
          <p className="font-medium">🎯 Target {fmtKg(t.targetKg)} kg sebelum {tglLengkap(t.lebaranDate)}</p>
          <ul className="mt-2 space-y-1 text-slate-300">
            <li>
              {o.daysLeft > 0 ? `${o.daysLeft} hari lagi (±${Math.round(o.weeksLeft)} minggu)` : "Tanggal target sudah lewat"}
            </li>
            {o.neededPerWeek != null && <li>Butuh naik ±{fmtKg(o.neededPerWeek)} kg/minggu dari rata-rata sekarang</li>}
            {o.projectedKg != null ? (
              <li>
                Kalau laju sekarang ({signed(rate ?? 0)} kg/minggu) bertahan, perkiraan <b>{fmtKg(o.projectedKg)} kg</b> di tanggal itu
              </li>
            ) : (
              <li className="text-slate-400">Butuh timbangan di dua minggu berturut-turut buat ngitung laju dan proyeksi.</li>
            )}
          </ul>
          <p className="mt-3 text-xs text-slate-500">
            Laju ideal buat lean bulk ±0,3–0,4 kg/minggu. Target lanjutan {fmtKg(t.stretchKg)} kg setelah Lebaran. Ramadan mulai ±{tglLengkap(t.ramadanStart)}: fokus jaga berat.
          </p>
        </div>
      )}

      {komposisi && (
        <div className="rounded-2xl border border-white/5 bg-white/[0.04] p-4">
          <p className="mb-3 text-sm font-medium text-slate-300">Komposisi badan ({tglSingkat(komposisi.date)})</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Kotak judul="Body fat" nilai={`${fmtKg(komposisi.bodyFatPct!)}%`} />
            <Kotak judul="Otot" nilai={komposisi.muscleMassKg != null ? `${fmtKg(komposisi.muscleMassKg)} kg` : "-"} />
            <Kotak judul="Visceral" nilai={komposisi.visceralFat != null ? fmtKg(komposisi.visceralFat) : "-"} />
            <Kotak judul="Air" nilai={komposisi.bodyWaterPct != null ? `${fmtKg(komposisi.bodyWaterPct)}%` : "-"} />
            <Kotak judul="Tulang" nilai={komposisi.boneMassKg != null ? `${fmtKg(komposisi.boneMassKg)} kg` : "-"} />
            <Kotak judul="BMR" nilai={komposisi.bmrKcal != null ? `${komposisi.bmrKcal}` : "-"} catatan="kcal" />
          </div>
          <p className="mt-3 text-xs text-slate-500">Hasil timbangan BIA dipengaruhi hidrasi. Bandingin cuma yang kondisinya sama (pagi, belum makan/minum).</p>
        </div>
      )}

      {laporan && (
        <details className="rounded-2xl border border-white/5 bg-white/[0.04] p-4">
          <summary className="cursor-pointer text-sm font-medium text-slate-300">📊 Laporan mingguan terakhir ({tglSingkat(laporan.week_end)})</summary>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{laporan.report_text}</p>
        </details>
      )}

      <div>
        <p className="mb-2 px-1 text-sm font-medium text-slate-300">Riwayat timbangan</p>
        {list.length === 0 ? (
          <p className="rounded-2xl border border-white/5 bg-white/[0.04] p-4 text-sm text-slate-400">Belum ada timbangan. Catat yang pertama di atas.</p>
        ) : (
          <ul className="space-y-2">
            {list.slice(0, 20).map((m) => (
              <BarisTimbangan
                key={m.id}
                id={m.id}
                date={m.date}
                weightKg={m.weightKg}
                kondisi={LABEL_KONDISI[m.condition]}
                standar={isStandar(m.condition)}
                sumber={SUMBER[m.source] ?? m.source}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Kotak({ judul, nilai, catatan }: { judul: string; nilai: string; catatan?: string }) {
  return (
    <div className="rounded-xl bg-white/5 px-2 py-3">
      <p className="text-[11px] text-slate-400">{judul}</p>
      <p className="mt-0.5 text-lg font-semibold">{nilai}</p>
      {catatan && <p className="text-[11px] text-slate-500">{catatan}</p>}
    </div>
  );
}
