import type { MetadataRoute } from "next";

// manifest PWA: biar LOKAWIRA bisa dipasang ke layar utama HP & kebuka layar penuh kyk aplikasi
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "LOKAWIRA: Pemandu Wisata Budaya",
    short_name: "LOKAWIRA",
    description: "Pemandu wisata budaya interaktif: peta, cerita Loka, pindai objek budaya, dan voucer UMKM lokal.",
    lang: "id",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F6EAD3",
    theme_color: "#F6EAD3",
    categories: ["travel", "education", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Peta budaya", short_name: "Peta", url: "/", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Kasir Mitra", short_name: "Kasir", url: "/merchant-pos", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
