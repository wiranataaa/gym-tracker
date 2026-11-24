import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Foto layar Tanita diunggah lewat Server Action (sudah diperkecil di browser, biasanya < 1 MB)
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  // Cache Components sengaja dimatikan: semua halaman app ini dinamis (data pribadi per login).
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
