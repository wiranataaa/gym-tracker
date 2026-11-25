import Link from "next/link";
import { requireOwner } from "@/lib/auth.ts";
import { kutipanHariIni, kutipanSelesai } from "@/lib/kutipan.ts";
import { fmtDurasi, nilaiTidur, TARGET_TIDUR_JAM } from "@/lib/tidur/hitung.ts";
import { getTidur, listTidur, tidurTerakhir } from "@/lib/tidur/db.ts";
import { namaHari, todayWIB, fmtInt, fmtKg } from "@/lib/time.ts";
import { loadTodayView } from "@/lib/workout/today.ts";
import { PanelTidur, type RiwayatTidurView, type TidurView } from "./_components/PanelTidur.tsx";
import { BannerTimbang } from "./_components/BannerTimbang.tsx";
import { GantiMenu } from "./_components/GantiMenu.tsx";
import { KesimpulanAI } from "./_components/KesimpulanAI.tsx";
import { PanelMulai } from "./_components/PanelMulai.tsx";
import { PanelSkip } from "./_components/PanelSkip.tsx";
import { Pencatat } from "./_components/Pencatat.tsx";

export const dynamic = "force-dynamic";

export default async function HariIniPage({ searchParams }: { searchParams: Promise<{ paksa?: string }> }) {
  await requireOwner();
  const { paksa } = await searchParams;
  const today = todayWIB();
  const [view, tidurHariIni, tidur7, tidurAkhir] = await Promise.all([
    loadTodayView(today, paksa === "1"),
    getTidur(today),
    listTidur(today, 7),
    tidurTerakhir(),
  ]);
  const tidurView: TidurView | null = tidurHariIni && {
    tanggalBangun: tidurHariIni.tanggalBangun,
    jamTidur: tidurHariIni.jamTidur,
    jamBangun: tidurHariIni.jamBangun,
    durasiTeks: fmtDurasi(tidurHariIni.durasiMenit),
    ...nilaiTidur(tidurHariIni.durasiMenit),
    kualitas: tidurHariIni.kualitas,
    catatan: tidurHariIni.catatan,
  };
  const riwayatTidur: RiwayatTidurView[] = [...tidur7].reverse().map((t) => ({
    tanggal: t.tanggalBangun,
    hari: namaHari(t.tanggalBangun).slice(0, 3),
    durasiTeks: fmtDurasi(t.durasiMenit).replace(" jam ", "j ").replace(" menit", "m").replace(" jam", "j"),
    level: nilaiTidur(t.durasiMenit).level,
  }));

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-slate-400">
          {namaHari(today)}, {today}
        </p>
        <h1 className="text-2xl font-semibold">Hari ini</h1>
      </div>

      {/* Pecut harian (beda tiap hari). Setelah latihan selesai ganti jadi pengakuan singkat. */}
      {view.kind === "selesai" ? (
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
          <p className="text-xs uppercase tracking-wide text-emerald-300/80">✅ Done for today</p>
          <p className="mt-1.5 text-base font-semibold leading-snug">{kutipanSelesai(today)}</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-orange-400/25 bg-gradient-to-br from-orange-500/15 to-red-500/10 p-4">
          <p className="text-xs uppercase tracking-wide text-orange-300/80">🔥 Today&apos;s kick in the ass</p>
          <p className="mt-1.5 text-base font-semibold leading-snug">{kutipanHariIni(today)}</p>
        </div>
      )}

      <PanelTidur
        key={tidurView ? `${tidurView.jamTidur}-${tidurView.jamBangun}-${tidurView.kualitas}-${tidurView.catatan}` : "kosong"}
        hariIni={tidurView}
        riwayat={riwayatTidur}
        awal={{ jamTidur: tidurAkhir?.jamTidur ?? "23:00", jamBangun: tidurAkhir?.jamBangun ?? "06:00" }}
        targetJam={TARGET_TIDUR_JAM}
      />

      {view.kind === "tanpa_program" && (
        <Kartu>Program latihan belum ada di database.</Kartu>
      )}

      {view.kind === "istirahat" && (
        <Kartu>
          <p className="text-lg font-medium">😴 Hari istirahat</p>
          <p className="mt-1 text-sm text-slate-400">
            Jadwal lo Senin–Jumat. Jalan kaki santai atau stretching aja cukup. Menu berikutnya: {view.dayName}.
          </p>
          <Link href="/?paksa=1" className="mt-4 block rounded-xl bg-white/10 px-4 py-3 text-center font-medium active:bg-white/20">
            💪 Tetap latihan
          </Link>
        </Kartu>
      )}

      {view.kind === "skip" && <PanelSkip />}

      {view.kind === "siap" && (
        <>
          <BannerTimbang teks={view.timbang} />
          <PanelMulai view={view} />
          <GantiMenu pilihan={view.pilihan} saatIni={view.dayId} />
        </>
      )}

      {view.kind === "berjalan" && (
        <>
          <BannerTimbang teks={view.timbang} />
          <Pencatat view={view} />
        </>
      )}

      {view.kind === "selesai" && (
        <div className="space-y-3">
          <Kartu>
            <p className="text-lg font-medium">🏁 {view.recap.dayName} selesai</p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <Angka label="Set" nilai={String(view.recap.totalSets)} />
              <Angka label="Volume (kg)" nilai={fmtInt(view.recap.volumeKg)} />
              <Angka label="Energi" nilai={view.recap.energy ? `${view.recap.energy}/5` : "-"} />
            </div>
            <p className="mt-3 text-sm text-slate-300">
              🚶 Kardio: {view.recap.cardioMin ? `${view.recap.cardioMin} menit` : "belum dicatat (catat dari tab Hari ini saat sesi berjalan, atau lewat bot: kardio 20)"}
            </p>
          </Kartu>

          <BannerTimbang teks={view.timbang} />

          <KesimpulanAI teks={view.kesimpulan} />

          {view.recap.exercises.map((e) => (
            <Kartu key={e.name}>
              <p className="font-medium">{e.name}</p>
              <p className="mt-1 text-sm text-slate-300">
                {e.sets} set · terbaik {fmtKg(e.bestWeightKg)} kg × {e.bestReps}
              </p>
              <p className="text-xs text-slate-500">{e.prevText ? `Sesi lalu: ${e.prevText}` : "Pertama kali dicatat"}</p>
            </Kartu>
          ))}

          {view.recap.nextDayName && (
            <p className="px-1 text-sm text-slate-400">Berikutnya di antrean: {view.recap.nextDayName}</p>
          )}
        </div>
      )}
    </div>
  );
}

function Kartu({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-white/5 bg-white/[0.04] p-4">{children}</div>;
}

function Angka({ label, nilai }: { label: string; nilai: string }) {
  return (
    <div className="rounded-xl bg-white/5 px-2 py-3">
      <p className="text-xl font-semibold">{nilai}</p>
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  );
}
