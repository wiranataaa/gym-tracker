import Link from "next/link";

// Pengingat timbang di gym (hari latihan terakhir minggu itu). Nggak ada timbangan di kosan.
export function BannerTimbang({ teks }: { teks: string | null }) {
  if (!teks) return null;
  return (
    <Link href="/badan" className="block rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm leading-relaxed active:bg-amber-400/20">
      <p>{teks}</p>
      <p className="mt-2 font-medium text-amber-200">Catat timbangan →</p>
    </Link>
  );
}
