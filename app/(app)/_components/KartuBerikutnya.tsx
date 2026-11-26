import type { Pratinjau } from "@/lib/workout/berikutnya.ts";

/** Pratinjau latihan berikutnya, dilipat; tap buat lihat gerakan dan targetnya. */
export function KartuBerikutnya({ data }: { data: Pratinjau }) {
  return (
    <details className="group rounded-2xl border border-sky-300/20 bg-sky-400/[0.06] p-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block text-xs text-sky-200/70">👀 Latihan berikutnya · {data.kapan}</span>
          <span className="mt-0.5 block font-semibold">{data.dayName}</span>
        </span>
        <span className="shrink-0 rounded-full bg-white/10 px-3 py-1.5 text-xs group-open:hidden">Lihat menu</span>
        <span className="hidden shrink-0 rounded-full bg-white/10 px-3 py-1.5 text-xs group-open:inline">Tutup</span>
      </summary>
      <ol className="mt-3 space-y-2 border-t border-white/5 pt-3">
        {data.gerakan.map((g, i) => (
          <li key={g.name} className="text-sm">
            <p className="font-medium">
              {i + 1}. {g.name}
            </p>
            <p className="text-slate-400">{g.target}</p>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-sm text-slate-300">🚶 Kardio: {data.kardioMenit} menit</p>
      <p className="mt-2 text-xs text-slate-500">Ini pratinjau. Target dihitung dari catatan lo sampai sekarang.</p>
    </details>
  );
}
