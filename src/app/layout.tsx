import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { LokawiraProvider } from "@/components/layout/LokawiraProvider";
import PerfMode from "@/components/ui/PerfMode";
import { MOTION_BOOT } from "@/lib/motionPref";
import { AuthProvider } from "@/components/layout/AuthProvider";
import { LocationProvider } from "@/components/layout/LocationProvider";

// font ditanam di repo (src/app/fonts, lisensi OFL) biar build gak bergantung ke jaringan/Google Fonts
// Figtree: sans bulat & ramah utk UI game yg dibbaca cepat di HP
const figtree = localFont({
  src: "./fonts/figtree-latin-wght-normal.woff2",
  variable: "--font-body",
  weight: "300 900",
  display: "swap",
});

// Fraunces: serif hangat dgn ujung membulat, terasa kyk cetakan lontar & buku cerita rakyat
const fraunces = localFont({
  src: "./fonts/fraunces-latin-wght-normal.woff2",
  variable: "--font-display",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: "LOKAWIRA: Geo-Cultural Quest & Ekonomi Sirkular UMKM",
  description:
    "Pemandu wisata budaya interaktif: peta, cerita Loka, pindai objek budaya, kuota antrean, dan voucer UMKM lokal (BUDAYA GO! 2026).",
  applicationName: "LOKAWIRA",
  // iPhone: buka layar penuh dr layar utama & pakai ikon Loka
  appleWebApp: { capable: true, title: "LOKAWIRA", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

// viewport-fit=cover wajib biar env(safe-area-inset-*) bekeerja di HP berponi/berbilah gestur
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#F6EAD3",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${figtree.variable} ${fraunces.variable}`}
      // data-motion dipasang skrip di bawah sblm React jalan
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: MOTION_BOOT }} />
      </head>
      <body className="bg-andesite text-alabaster antialiased">
        <PerfMode />
        <AuthProvider>
          <LokawiraProvider>
            <LocationProvider>{children}</LocationProvider>
          </LokawiraProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
