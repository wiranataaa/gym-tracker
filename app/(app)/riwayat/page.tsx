import Link from "next/link";
import { requireOwner } from "@/lib/auth.ts";
import { fmtInt, tglPendek } from "@/lib/time.ts";
import { listSessions } from "@/lib/workout/history.ts";

export default async function RiwayatPage() {
  await requireOwner();
  const sessions = await listSessions();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Riwayat</h1>

      {sessions.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-white/[0.04] p-5 text-center text-sm text-slate-400">
          Belum ada latihan tercatat. Mulai dari tab <b className="text-slate-200">Hari ini</b>.
        </div>
      ) : (
        <ul className="space-y-2">
          {sessions.map((s) => (
            <li key={s.id}>
              <Link
                href={`/riwayat/${s.id}`}
                className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.04] p-4 active:bg-white/10"
              >
                <div>
                  <p className="font-medium">{s.dayName}</p>
                  <p className="text-sm text-slate-400">
                    {tglPendek(s.date)}
                    {s.mode === "singkat" ? " · singkat" : ""}
                    {s.status === "berjalan" ? " · belum selesai" : ""}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <p>{s.totalSets} set</p>
                  <p className="text-slate-400">{fmtInt(s.volumeKg)} kg{s.energy ? ` · ⚡${s.energy}/5` : ""}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
