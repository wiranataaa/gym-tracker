import { NextResponse } from "next/server";
import { isOwnerEmail, supabaseAuth } from "@/lib/auth.ts";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (code) {
    const supabase = await supabaseAuth();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (isOwnerEmail(user?.email)) return NextResponse.redirect(`${url.origin}/`);
      // Login Google berhasil, tapi bukan email pemilik: keluarkan lagi
      await supabase.auth.signOut();
      const ownerKosong = !process.env.OWNER_EMAIL?.trim();
      return NextResponse.redirect(`${url.origin}/login?error=${ownerKosong ? "owner_kosong" : "tidak_diizinkan"}`);
    }
  }
  return NextResponse.redirect(`${url.origin}/login?error=gagal`);
}
