import { isOwnerEmail, supabaseAuth } from "@/lib/auth.ts";
import { buatExport, JENIS_VALID, type JenisExport } from "@/lib/export/data.ts";
import { todayWIB } from "@/lib/time.ts";

export const maxDuration = 30;

// Unduh CSV (latihan / nutrisi / timbangan). /api tidak lewat proxy login, jadi cek pemilik di sini.
export async function GET(_request: Request, { params }: { params: Promise<{ jenis: string }> }) {
  const supabase = await supabaseAuth();
  const { data } = await supabase.auth.getClaims();
  const email = (data?.claims as { email?: string } | undefined)?.email;
  if (!data?.claims || !isOwnerEmail(email)) return new Response("Unauthorized", { status: 401 });

  const { jenis } = await params;
  if (!JENIS_VALID.includes(jenis as JenisExport)) return new Response("Jenis export nggak dikenal", { status: 404 });

  try {
    const csv = await buatExport(jenis as JenisExport);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="gym-tracker-${jenis}-${todayWIB()}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("Export gagal:", err);
    return new Response("Export gagal", { status: 500 });
  }
}
