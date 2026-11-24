"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TAB = [
  { href: "/", label: "Hari ini", icon: "🏋️" },
  { href: "/riwayat", label: "Riwayat", icon: "📋" },
  { href: "/progres", label: "Progres", icon: "📈" },
  { href: "/badan", label: "Badan", icon: "⚖️" },
];

export function NavBawah() {
  const path = usePathname();
  const aktif = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-[#0b0f14]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto grid max-w-md grid-cols-4">
        {TAB.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={`flex flex-col items-center gap-0.5 py-2.5 text-xs ${aktif(t.href) ? "text-emerald-300" : "text-slate-400"}`}
          >
            <span className="text-xl leading-none">{t.icon}</span>
            {t.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
