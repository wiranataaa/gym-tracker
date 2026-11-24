import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth.ts";
import { fmtInt, tglPendek } from "@/lib/time.ts";
import { getSessionDetail } from "@/lib/workout/history.ts";
import { BarisSet } from "./BarisSet.tsx";
import { HapusSesi } from "./HapusSesi.tsx";

export default async function DetailSesiPage({ params }: { params: Promise<{ id: string }> }) {
  await requireOwner();
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isInteger(sessionId) || sessionId <= 0) notFound();

  const s = await getSessionDetail(sessionId);
  if (!s) notFound();

  const working = s.exercises.flatMap((e) => e.sets.filter((x) => !x.isWarmup));
  const volume = working.reduce((a, x) => a + x.weightKg * x.reps, 0);

  return (
    <div className="space-y-4">
      <Link href="/riwayat" className="text-sm text-slate-400">
        ← Riwayat
      </Link>

      <div>
        <h1 className="text-2xl font-semibold">{s.dayName}</h1>
        <p className="text-sm text-slate-400">
          {tglPendek(s.date)}
          {s.mode === "singkat" ? " · versi singkat" : ""} · {working.length} set · {fmtInt(volume)} kg
          {s.energy ? ` · energi ${s.energy}/5` : ""}
        </p>
      </div>

      {s.exercises.length === 0 && <p className="text-sm text-slate-400">Nggak ada set di sesi ini.</p>}

      {s.exercises.map((e) => (
        <section key={e.exerciseId} className="rounded-2xl border border-white/5 bg-white/[0.04] p-4">
          <p className="mb-2 font-medium">{e.name}</p>
          <div className="space-y-1">
            {e.sets.map((x, i) => (
              <BarisSet key={x.id} nomor={i + 1} set={x} />
            ))}
          </div>
        </section>
      ))}

      <HapusSesi id={s.id} />
    </div>
  );
}
