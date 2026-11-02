import type { Metadata, Viewport } from "next";
import { Figtree, Fraunces } from "next/font/google";
import "./globals.css";
import { LokawiraProvider } from "@/components/layout/LokawiraProvider";
import PerfMode from "@/components/ui/PerfMode";
import { AuthProvider } from "@/components/layout/AuthProvider";

// Figtree: sans bulat & ramah utk UI game yg dibbaca cepat di HP
const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700", "800"],
});

// Fraunces: serif hangat dgn ujung membulat, terasa kyk cetakan lontar & buku cerita rakyat
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "LOKAWIRA: Geo-Cultural Quest & Ekonomi Sirkular UMKM",
  description:
    "Platform Pemandu Wisata Budaya Interaktif Berbasis Geo-Cultural Quest, Object Lens Scanner, Smart Quota Redistribution, dan One-Tap UMKM Micro-POS (BUDAYA GO! 2026).",
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
    >
      <body className="bg-andesite text-alabaster antialiased">
        <PerfMode />
        <AuthProvider>
          <LokawiraProvider>{children}</LokawiraProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
