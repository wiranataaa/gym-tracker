"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

// Menampilkan kesimpulan latihan. Kalau belum siap (AI masih menulis), muat ulang tiap 3 detik, maksimal 10 kali.
export function KesimpulanAI({ teks }: { teks: string | null }) {
  const router = useRouter();
  const percobaan = useRef(0);

  useEffect(() => {
    if (teks) return;
    const t = setInterval(() => {
      percobaan.current += 1;
      if (percobaan.current > 10) clearInterval(t);
      else router.refresh();
    }, 3000);
    return () => clearInterval(t);
  }, [teks, router]);

  if (!teks) {
    return (
      <div className="animate-pulse rounded-2xl border border-white/5 bg-white/[0.04] p-4 text-sm text-slate-400">
        🧠 Lagi nulis kesimpulan…
      </div>
    );
  }

  return <div className="whitespace-pre-wrap rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.06] p-4 text-sm leading-relaxed">{teks}</div>;
}
