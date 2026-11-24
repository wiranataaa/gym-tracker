import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

// Login Google lewat Supabase Auth. Cuma email pemilik (OWNER_EMAIL) yang boleh masuk.

export async function supabaseAuth() {
  const cookieStore = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Dipanggil dari Server Component: cookie diperbarui oleh proxy.ts
        }
      },
    },
  });
}

/**
 * Gagal tertutup: kalau OWNER_EMAIL belum diisi, semua orang ditolak.
 * Boleh lebih dari satu email, dipisah koma (misal dua akun Google milik pemilik).
 */
export function isOwnerEmail(email?: string | null): boolean {
  const owners = (process.env.OWNER_EMAIL ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return !!email && owners.includes(email.trim().toLowerCase());
}

/**
 * Wajib dipanggil di setiap halaman dan Server Action yang menyentuh data.
 * Pakai getClaims(): tanda tangan JWT diperiksa lokal (kunci publiknya di-cache), jadi
 * nggak ada panggilan jaringan ke Supabase Auth di setiap klik. Proxy tetap menyegarkan sesi.
 */
export async function requireOwner() {
  const supabase = await supabaseAuth();
  const { data } = await supabase.auth.getClaims();
  const email = (data?.claims as { email?: string } | undefined)?.email;
  if (!data?.claims || !isOwnerEmail(email)) redirect("/login");
  return { email: email as string };
}
