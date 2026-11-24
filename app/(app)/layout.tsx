import { keluar } from "./actions.ts";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-white/5 bg-[#0b0f14]/90 px-5 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="text-xl">🏋️</span>
          <span className="font-semibold">Gym Tracker</span>
        </div>
        <form action={keluar}>
          <button className="rounded-lg px-3 py-1.5 text-sm text-slate-400 active:bg-white/10">Keluar</button>
        </form>
      </header>
      <main className="flex-1 px-4 pb-24 pt-4">{children}</main>
    </div>
  );
}
