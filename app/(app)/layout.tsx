import Link from "next/link";
import { keluar } from "./actions.ts";
import { NavBawah } from "./_components/NavBawah.tsx";
import { TimerIstirahat } from "./_components/TimerIstirahat.tsx";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      {/* pt = area aman atas (poni/status bar iPhone) */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-white/5 bg-[#0b0f14]/90 px-5 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="text-xl">🏋️</span>
          <span className="font-semibold">Gym Tracker</span>
        </div>
        <div className="flex items-center gap-1">
          <Link href="/pengaturan" aria-label="Pengaturan" className="rounded-lg px-3 py-1.5 text-lg active:bg-white/10">
            ⚙️
          </Link>
          <form action={keluar}>
            <button className="rounded-lg px-3 py-1.5 text-sm text-slate-400 active:bg-white/10">Keluar</button>
          </form>
        </div>
      </header>

      {/* pb = tinggi menu bawah (±4rem) + area aman bawah (garis home iPhone) + napas */}
      <main className="flex-1 px-4 pt-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))]">{children}</main>
      <TimerIstirahat />
      <NavBawah />
    </div>
  );
}
