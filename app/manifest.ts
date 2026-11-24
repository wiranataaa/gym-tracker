import type { MetadataRoute } from "next";

// Supaya app bisa dipasang ke layar utama HP dan terbuka layar penuh seperti aplikasi biasa.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gym Tracker",
    short_name: "Gym Tracker",
    description: "Catatan latihan, nutrisi, dan progres pribadi",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b0f14",
    theme_color: "#0b0f14",
    lang: "id",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
