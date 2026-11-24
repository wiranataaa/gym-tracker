// Tampil langsung saat pindah menu, selagi data halaman dimuat di server.
export default function Loading() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Memuat">
      <div className="h-4 w-28 rounded bg-white/10" />
      <div className="h-8 w-40 rounded bg-white/10" />
      <div className="h-40 rounded-2xl bg-white/[0.06]" />
      <div className="h-24 rounded-2xl bg-white/[0.06]" />
      <div className="h-24 rounded-2xl bg-white/[0.06]" />
    </div>
  );
}
