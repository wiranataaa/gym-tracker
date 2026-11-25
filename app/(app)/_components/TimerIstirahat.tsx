"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { fmtMenitDetik, geserTotal, sisaDetik } from "@/lib/workout/istirahat.ts";
import { bacaSakelarMentah, bacaTimerMentah, bunyi, hentikanTimer, parseTimer, setTimerNyala, subscribe, timerNyala, ubahTimer } from "./timerStore.ts";

/** Timer istirahat mengambang di atas menu bawah. Dipasang sekali di layout, muncul otomatis habis catat set. */
export function TimerIstirahat() {
  const raw = useSyncExternalStore(subscribe, bacaTimerMentah, () => null);
  const t = useMemo(() => parseTimer(raw), [raw]);
  const [now, setNow] = useState(() => Date.now());
  const sudahBunyi = useRef(0);

  // Detak tiap 250 ms selama timer ada; juga langsung hitung ulang waktu app dibuka lagi dari background
  useEffect(() => {
    if (!t) return;
    const tick = () => setNow(Date.now());
    const id = setInterval(tick, 250);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [t]);

  const sisa = t ? sisaDetik(t.akhir, now) : 0;
  const selesai = !!t && sisa === 0;

  // Bunyi sekali saat habis. Kalau sudah lewat lama (app baru dibuka lagi), diam-diam bersihkan saja.
  useEffect(() => {
    if (!t || !selesai) return;
    const telat = Date.now() - t.akhir > 8000;
    if (telat) {
      hentikanTimer();
      return;
    }
    if (sudahBunyi.current !== t.akhir) {
      sudahBunyi.current = t.akhir;
      bunyi();
    }
    const id = setTimeout(hentikanTimer, 7000);
    return () => clearTimeout(id);
  }, [t, selesai]);

  // Jaga layar tetap nyala selama istirahat (kalau didukung) supaya bunyi habis nggak terlewat
  const aktif = !!t && !selesai;
  useEffect(() => {
    if (!aktif || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let batal = false;
    navigator.wakeLock
      .request("screen")
      .then((l) => {
        if (batal) void l.release();
        else lock = l;
      })
      .catch(() => {});
    return () => {
      batal = true;
      void lock?.release().catch(() => {});
    };
  }, [aktif]);

  if (!t) return null;

  const geser = (d: number) => {
    const total = geserTotal(t.total, d);
    ubahTimer({ akhir: t.akhir + (total - t.total) * 1000, total });
  };
  const persen = Math.min(100, Math.max(0, 100 - (sisa / t.total) * 100));

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 mx-auto max-w-md px-4">
      {selesai ? (
        <button
          onClick={hentikanTimer}
          className="pointer-events-auto w-full rounded-2xl bg-emerald-500 px-4 py-4 text-center text-lg font-bold text-emerald-950 shadow-lg shadow-black/40 active:scale-[0.98]"
        >
          💪 Gas, set berikutnya!
        </button>
      ) : (
        <div className="pointer-events-auto relative overflow-hidden rounded-2xl border border-white/10 bg-[#141a22]/95 shadow-lg shadow-black/40 backdrop-blur">
          <div className="absolute inset-y-0 left-0 bg-emerald-500/20 transition-[width] duration-300" style={{ width: `${persen}%` }} />
          <div className="relative flex items-center gap-2 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] leading-none text-slate-400">⏱ Istirahat</p>
              <p className="mt-1 text-2xl font-semibold leading-none tabular-nums">{fmtMenitDetik(sisa)}</p>
            </div>
            <button onClick={() => geser(-15)} className="rounded-xl bg-white/10 px-3 py-2 text-sm active:bg-white/20">
              −15
            </button>
            <button onClick={() => geser(15)} className="rounded-xl bg-white/10 px-3 py-2 text-sm active:bg-white/20">
              +15
            </button>
            <button onClick={hentikanTimer} className="rounded-xl bg-white/10 px-3 py-2 text-sm text-slate-300 active:bg-white/20">
              Lewati
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Saklar kecil "Timer istirahat nyala/mati" (tersimpan di HP ini). */
export function SakelarTimer() {
  const raw = useSyncExternalStore(subscribe, bacaSakelarMentah, () => null);
  const nyala = timerNyala(raw);
  return (
    <button
      onClick={() => setTimerNyala(!nyala)}
      className={`rounded-full px-3 py-1 text-xs ${nyala ? "bg-emerald-500/20 text-emerald-200" : "bg-white/10 text-slate-400"}`}
      aria-pressed={nyala}
    >
      ⏱ Timer {nyala ? "nyala" : "mati"}
    </button>
  );
}
