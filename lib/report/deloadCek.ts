import { deteksiDeload, type RiwayatE1rm, type SaranDeload } from "../program/deload.ts";
import { getSettings } from "../workout/db.ts";
import { exercisesWithData, getProgress, listSessions } from "../workout/history.ts";

export type StatusDeload = SaranDeload & { aktif: boolean; sampai: string | null };

/** Kumpulkan data (baca-saja) lalu tanyakan ke aturan deteksi deload. */
export async function cekDeload(today: string): Promise<StatusDeload> {
  const [settings, sesi, daftar] = await Promise.all([getSettings(today), listSessions(400), exercisesWithData()]);

  const selesai = sesi.filter((s) => s.status === "selesai" && s.totalSets > 0);
  const tanggal = selesai.map((s) => s.date).sort();
  const sesiPertama = tanggal[0] ?? null;
  const acuan = [settings.deload_terakhir, sesiPertama].filter((x): x is string => !!x).sort().pop() ?? null;
  const sesiSejakAcuan = acuan ? tanggal.filter((t) => t >= acuan).length : 0;

  const riwayat: RiwayatE1rm[] = [];
  for (const ex of daftar.slice(0, 12)) {
    const p = await getProgress(ex.id);
    riwayat.push({ nama: ex.name, e1rm: p.points.map((x) => x.e1rm) });
  }

  const saran = deteksiDeload({
    today,
    deloadTerakhir: settings.deload_terakhir,
    sesiPertama,
    sesiSejakAcuan,
    riwayat,
    sedangDeload: settings.deload_aktif,
  });
  return { ...saran, aktif: settings.deload_aktif, sampai: settings.deload_sampai };
}
