import Link from "next/link";
import { requireOwner } from "@/lib/auth.ts";
import { namaHari, todayWIB, fmtInt, fmtKg } from "@/lib/time.ts";
import { loadTodayView } from "@/lib/workout/today.ts";
import { PanelMulai } from "./_components/PanelMulai.tsx";
import { PanelSkip } from "./_components/PanelSkip.tsx";
import { Pencatat } from "./_components/Pencatat.tsx";

export const dynamic = "force-dynamic";

export default async function HariIniPage({ searchParams }: { searchParams: Promise<{ paksa?: string }> }) {
  await requireOwner();
  const { paksa } = await searchParams;
  const today = todayWIB();
  const view = await loadTodayView(today, paksa === "1");

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-slate-400">
          {namaHari(today)}, {today}
        </p>
        <h1 className="text-2xl font-semibold">Hari ini</h1>
      </div>

      {view.kind === "tanpa_program" && (
        <Kartu>Program latihan belum ada di database.</Kartu>
      )}

      {view.kind === "istirahat" && (
        <Kartu>
          <p className="text-lg font-medium">😴 Hari istirahat</p>
          <p className="mt-1 text-sm text-slate-400">
            Jadwal lo Senin–Jumat. Jalan kaki santai atau stretching aja cukup. Menu berikutnya: {view.dayName}.
          </p>
          <Link href="/?paksa=1" className="mt-4 block rounded-xl bg-white/10 px-4 py-3 text-center font-medium active:bg-white/20">
            💪 Tetap latihan
          </Link>
        </Kartu>
      )}

      {view.kind === "skip" && <PanelSkip />}

      {view.kind === "siap" && <PanelMulai view={view} />}

      {view.kind === "berjalan" && <Pencatat view={view} />}

      {view.kind === "selesai" && (
        <div className="space-y-3">
          <Kartu>
            <p className="text-lg font-medium">🏁 {view.recap.dayName} selesai</p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <Angka label="Set" nilai={String(view.recap.totalSets)} />
              <Angka label="Volume (kg)" nilai={fmtInt(view.recap.volumeKg)} />
              <Angka label="Energi" nilai={view.recap.energy ? `${view.recap.energy}/5` : "-"} />
            </div>
          </Kartu>

          {view.recap.exercises.map((e) => (
            <Kartu key={e.name}>
              <p className="font-medium">{e.name}</p>
              <p className="mt-1 text-sm text-slate-300">
                {e.sets} set · terbaik {fmtKg(e.bestWeightKg)} kg × {e.bestReps}
              </p>
              <p className="text-xs text-slate-500">{e.prevText ? `Sesi lalu: ${e.prevText}` : "Pertama kali dicatat"}</p>
            </Kartu>
          ))}

          {view.recap.nextDayName && (
            <p className="px-1 text-sm text-slate-400">Berikutnya di antrean: {view.recap.nextDayName}</p>
          )}
        </div>
      )}
    </div>
  );
}

function Kartu({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-white/5 bg-white/[0.04] p-4">{children}</div>;
}

function Angka({ label, nilai }: { label: string; nilai: string }) {
  return (
    <div className="rounded-xl bg-white/5 px-2 py-3">
      <p className="text-xl font-semibold">{nilai}</p>
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  );
}
