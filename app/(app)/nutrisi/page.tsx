import Link from "next/link";
import { requireOwner } from "@/lib/auth.ts";
import { persen, sisa } from "@/lib/nutrition/calc.ts";
import { bagiRamadan } from "@/lib/ramadan/ramadan.ts";
import { dayTotals, listFavorites, listMeals, recentDays, signedPhotoUrls } from "@/lib/nutrition/db.ts";
import { addDays, fmtInt, fmtKg, tglPendek, todayWIB } from "@/lib/time.ts";
import { getSettings } from "@/lib/workout/db.ts";
import { KartuMakan, type MakanView } from "./KartuMakan.tsx";
import { PanelFavorit } from "./PanelFavorit.tsx";
import { PanelSuplemen } from "./PanelSuplemen.tsx";
import { hitungHariIni, listSuplemen } from "@/lib/suplemen/db.ts";

const SUMBER: Record<string, string> = { foto: "foto", teks: "teks", favorit: "favorit", manual: "manual" };

function jamWIB(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso)).replace(".", ":");
}

export default async function NutrisiPage({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  await requireOwner();
  const today = todayWIB();
  const { d } = await searchParams;
  const date = d && /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= today ? d : today;
  const isToday = date === today;

  const [meals, totals, settings, favs, recent, suplemen, hitungSup] = await Promise.all([
    listMeals(date),
    dayTotals(date),
    getSettings(),
    listFavorites(),
    recentDays(7, today),
    listSuplemen(true),
    hitungHariIni(date),
  ]);
  const fotos = await signedPhotoUrls(meals.map((m) => m.photoPath ?? "").filter(Boolean));

  const views: MakanView[] = meals.map((m) => ({
    id: m.id,
    jam: jamWIB(m.eatenAt),
    deskripsi: m.description ?? "Makanan",
    foto: m.photoPath ? (fotos.get(m.photoPath) ?? null) : null,
    status: m.status,
    sumber: SUMBER[m.source] ?? m.source,
    factor: m.factor,
    kcal: m.kcal,
    proteinG: m.proteinG,
    carbsG: m.carbsG,
    fatG: m.fatG,
    kcalMin: m.kcalMin,
    kcalMax: m.kcalMax,
    keyakinan: m.confidence,
    items: m.items.map((i) => ({ id: i.id, name: i.name, portionG: i.portionG, kcal: i.kcal, proteinG: i.proteinG })),
  }));

  const kcalPct = persen(totals.kcal, settings.target_kcal);
  const protPct = persen(totals.proteinG, settings.target_protein_g);
  const avg = recent.length
    ? {
        kcal: Math.round(recent.reduce((a, r) => a + r.kcal, 0) / recent.length),
        protein: Math.round(recent.reduce((a, r) => a + r.proteinG, 0) / recent.length),
        hariProtein: recent.filter((r) => r.proteinG >= settings.target_protein_g).length,
      }
    : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Nutrisi</h1>
        <div className="flex items-center gap-1 text-sm">
          <Link href={`/nutrisi?d=${addDays(date, -1)}`} className="rounded-lg bg-white/10 px-3 py-2" aria-label="Hari sebelumnya">
            ‹
          </Link>
          <span className="min-w-24 text-center">{isToday ? "Hari ini" : tglPendek(date)}</span>
          {isToday ? (
            <span className="rounded-lg px-3 py-2 text-slate-600">›</span>
          ) : (
            <Link href={`/nutrisi?d=${addDays(date, 1)}`} className="rounded-lg bg-white/10 px-3 py-2" aria-label="Hari berikutnya">
              ›
            </Link>
          )}
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-white/5 bg-white/[0.04] p-4">
        <Bar judul="Kalori" nilai={`${fmtInt(totals.kcal)} / ${fmtInt(settings.target_kcal)} kcal`} pct={kcalPct} warna="bg-emerald-400" />
        <Bar judul="Protein" nilai={`${fmtKg(totals.proteinG)} / ${settings.target_protein_g} g`} pct={protPct} warna="bg-sky-400" />
        <p className="text-sm text-slate-300">
          {sisa(totals.kcal, settings.target_kcal) > 0 || sisa(totals.proteinG, settings.target_protein_g) > 0
            ? `Sisa: ${fmtInt(sisa(totals.kcal, settings.target_kcal))} kcal · protein ${fmtKg(sisa(totals.proteinG, settings.target_protein_g))} g`
            : "🎉 Target hari ini tercapai"}
        </p>
        <p className="text-xs text-slate-500">
          Karbo {fmtKg(totals.carbsG)} g · Lemak {fmtKg(totals.fatG)} g · {totals.count} kali makan tersimpan
        </p>
      </div>

      {settings.ramadan_aktif && (
        <div className="space-y-2 rounded-2xl border border-indigo-300/20 bg-indigo-400/10 p-4 text-sm">
          <p className="font-medium">🌙 Mode Ramadan: target maintenance {fmtInt(settings.target_kcal)} kcal</p>
          {bagiRamadan(settings.target_kcal, settings.target_protein_g).map((p) => (
            <p key={p.nama} className="text-slate-200">
              <b>{p.nama}</b>: ±{fmtInt(p.kcal)} kcal · protein ±{p.proteinG} g
              <span className="block text-xs text-slate-400">{p.saran}</span>
            </p>
          ))}
        </div>
      )}

      {avg && (
        <p className="px-1 text-sm text-slate-400">
          7 hari terakhir (hari yang ada catatan): rata-rata {fmtInt(avg.kcal)} kcal · protein {avg.protein} g · target protein tercapai {avg.hariProtein}/{recent.length} hari
        </p>
      )}

      <div>
        <p className="mb-2 px-1 text-sm font-medium text-slate-300">Makan</p>
        {views.length === 0 ? (
          <div className="rounded-2xl border border-white/5 bg-white/[0.04] p-4 text-sm text-slate-400">
            Belum ada makanan tercatat.{" "}
            {isToday && (
              <>
                Kirim <b className="text-slate-200">foto makanan</b> ke bot Telegram{" "}
                <a href="https://t.me/gym_tracker_nata_bot" className="text-emerald-300 underline">
                  @gym_tracker_nata_bot
                </a>{" "}
                atau catat dari favorit di bawah.
              </>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {views.map((m) => (
              <KartuMakan key={`${m.id}-${m.factor}-${m.status}`} m={m} />
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="mb-2 px-1 text-sm font-medium text-slate-300">💊 Suplemen</p>
        <PanelSuplemen
          bisaCatat={isToday}
          items={suplemen.map((s) => ({
            id: s.id,
            name: s.name,
            doseDesc: s.doseDesc,
            kcal: s.kcal,
            proteinG: s.proteinG,
            carbsG: s.carbsG,
            fatG: s.fatG,
            pengingat: s.pengingat,
            count: hitungSup.get(s.id) ?? 0,
          }))}
        />
      </div>

      <div>
        <p className="mb-2 px-1 text-sm font-medium text-slate-300">⭐ Favorit</p>
        <PanelFavorit favs={favs.map((f) => ({ id: f.id, name: f.name, kcal: f.kcal, proteinG: f.proteinG }))} bisaCatat={isToday} />
      </div>

      <p className="px-1 text-xs text-slate-500">
        Estimasi dari foto bisa meleset ±20–30%. Yang penting konsistensi tren, bukan presisi per piring. Koreksi porsi atau simpan ke favorit supaya makin akurat.
      </p>
    </div>
  );
}

function Bar({ judul, nilai, pct, warna }: { judul: string; nilai: string; pct: number; warna: string }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-sm text-slate-300">{judul}</span>
        <span className="text-sm">
          <b>{nilai}</b> <span className="text-slate-500">({pct}%)</span>
        </span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full ${warna}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  );
}
