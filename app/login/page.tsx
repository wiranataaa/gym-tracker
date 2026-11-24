import { LoginButton } from "./LoginButton";

const PESAN: Record<string, string> = {
  tidak_diizinkan: "Email akun Google itu beda dengan OWNER_EMAIL di server. Cek ejaan OWNER_EMAIL di Vercel, atau pakai akun Google yang sama.",
  owner_kosong: "OWNER_EMAIL belum kebaca di server. Isi di Vercel (Settings → Environment Variables) lalu Redeploy.",
  gagal: "Login gagal. Coba lagi.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/15 text-3xl">🏋️</div>
        <h1 className="text-2xl font-semibold">Gym Tracker</h1>
        <p className="mt-2 text-sm text-slate-400">Catatan latihan, nutrisi, dan progres pribadi.</p>

        {error && (
          <p className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {PESAN[error] ?? PESAN.gagal}
          </p>
        )}

        <LoginButton />
      </div>
    </main>
  );
}
