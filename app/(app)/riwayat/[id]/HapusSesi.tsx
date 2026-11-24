"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { hapusSesi } from "../actions.ts";

export function HapusSesi({ id }: { id: number }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!confirm) {
    return (
      <button onClick={() => setConfirm(true)} className="w-full rounded-2xl border border-red-400/20 py-3 text-sm text-red-300 active:bg-red-500/10">
        Hapus seluruh sesi ini
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-red-400/30 bg-red-500/10 p-4">
      <p className="text-sm">Semua set di sesi ini ikut terhapus dan nggak bisa dibalikin. Yakin?</p>
      {error && <p className="text-sm text-red-300">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await hapusSesi(id);
              if (r.ok) router.replace("/riwayat");
              else setError(r.error);
            })
          }
          className="rounded-xl bg-red-500 py-3 font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Menghapus…" : "Ya, hapus"}
        </button>
        <button onClick={() => setConfirm(false)} className="rounded-xl bg-white/10 py-3">
          Batal
        </button>
      </div>
    </div>
  );
}
