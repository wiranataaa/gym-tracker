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

/** Gagal tertutup: kalau OWNER_EMAIL belum diisi, semua orang ditolak. */
export function isOwnerEmail(email?: string | null): boolean {
  const owner = process.env.OWNER_EMAIL?.trim().toLowerCase();
  return !!owner && !!email && email.trim().toLowerCase() === owner;
}

/** Wajib dipanggil di setiap halaman dan Server Action yang menyentuh data. */
export async function requireOwner() {
  const supabase = await supabaseAuth();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isOwnerEmail(user.email)) redirect("/login");
  return user;
}
