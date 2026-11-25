import Link from "next/link";
import { requireOwner } from "@/lib/auth.ts";
import { fmtKg, tglSingkat } from "@/lib/time.ts";
import { exercisesWithData, getProgress } from "@/lib/workout/history.ts";
import { GrafikGaris } from "../_components/GrafikGaris.tsx";

export default async function ProgresPage({ searchParams }: { searchParams: Promise<{ g?: string }> }) {
  await requireOwner();
  const { g } = await searchParams;

  const list = await exercisesWithData();
  const selectedId = list.find((e) => String(e.id) === g)?.id ?? list[0]?.id;
  const selected = list.find((e) => e.id === selectedId);
  const progress = selectedId ? await getProgress(selectedId) : null;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Progres</h1>

      {!selected || !progress ? (
        <div className="rounded-2xl border border-white/5 bg-white/[0.04] p-5 text-center text-sm text-slate-400">
          Belum ada data. Catat beberapa latihan dulu, nanti grafik beban dan estimasi 1RM muncul di sini.
        </div>
      ) : (
        <>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {list.map((e) => (
              <Link
                key={e.id}
                href={`/progres?g=${e.id}`}
                className={`shrink-0 rounded-full px-3.5 py-2 text-sm ${e.id === selected.id ? "bg-emerald-500 font-semibold text-emerald-950" : "bg-white/10"}`}
              >
                {e.name}
              </Link>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Kotak
              judul="🏆 Estimasi 1RM terbaik"
              nilai={progress.bestE1rm ? `${fmtKg(progress.bestE1rm.value)} kg` : "-"}
              catatan={progress.bestE1rm ? `${fmtKg(progress.bestE1rm.weightKg)} × ${progress.bestE1rm.reps} · ${tglSingkat(progress.bestE1rm.date)}` : ""}
            />
            <Kotak
              judul="💪 Beban terberat"
              nilai={progress.heaviest ? `${fmtKg(progress.heaviest.weightKg)} kg` : "-"}
              catatan={progress.heaviest ? `× ${progress.heaviest.reps} · ${tglSingkat(progress.heaviest.date)}` : ""}
            />
          </div>

          <Kartu judul="Beban terbaik per sesi">
            <GrafikGaris titik={progress.points.map((p) => ({ label: tglSingkat(p.date), value: p.bestWeightKg }))} />
          </Kartu>

          <Kartu judul="Estimasi 1RM per sesi">
            <GrafikGaris warna="#38bdf8" titik={progress.points.map((p) => ({ label: tglSingkat(p.date), value: p.e1rm }))} />
          </Kartu>

          <details className="rounded-2xl border border-white/5 bg-white/[0.04] p-4 text-sm">
            <summary className="cursor-pointer font-medium text-slate-300">Apa itu estimasi 1RM?</summary>
            <p className="mt-2 leading-relaxed text-slate-300">
              1RM = beban maksimal yang bisa lo angkat <b>1 kali</b>. Di sini bukan hasil tes beneran, tapi perkiraan dari set terbaik tiap sesi pakai rumus Epley: <b>beban × (1 + reps ÷ 30)</b>. Contoh: 18 kg × 12 = 18 × (1 + 12/30) = 25,2 kg.
            </p>
            <p className="mt-2 leading-relaxed text-slate-400">
              Gunanya biar kekuatan antar sesi bisa dibandingin walau jumlah repsnya beda (misalnya 60 kg × 8 vs 55 kg × 12), dan buat deteksi PR. Garisnya naik = lo makin kuat. Makin tinggi repsnya, makin kasar perkiraannya.
            </p>
          </details>
          <p className="px-1 text-xs text-slate-500">{progress.points.length} sesi tercatat.</p>
        </>
      )}
    </div>
  );
}

function Kartu({ judul, children }: { judul: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.04] p-4">
      <p className="mb-2 text-sm font-medium text-slate-300">{judul}</p>
      {children}
    </div>
  );
}

function Kotak({ judul, nilai, catatan }: { judul: string; nilai: string; catatan: string }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.04] p-3">
      <p className="text-xs text-slate-400">{judul}</p>
      <p className="mt-1 text-xl font-semibold">{nilai}</p>
      <p className="text-xs text-slate-500">{catatan}</p>
    </div>
  );
}
