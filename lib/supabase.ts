import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Klien server (secret key). JANGAN dipakai di kode yang jalan di browser.
let client: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Env Supabase belum diisi");
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      // Batas waktu per panggilan supaya fungsi serverless nggak menggantung
      global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(8000) }) },
    });
  }
  return client;
}

/** Lempar error kalau query gagal, kembalikan datanya kalau berhasil. */
export function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(`Database: ${res.error.message}`);
  return res.data as T;
}
