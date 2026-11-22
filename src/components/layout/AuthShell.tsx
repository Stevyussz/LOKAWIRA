import React from "react";
import Loka, { LokaMood } from "@/components/brand/Loka";
import { NusantaraCornerFrame, NusantaraDivider, NusantaraPatternStrip } from "@/components/brand/NusantaraOrnaments";
import { AUTH_BG } from "@/lib/brand";

interface Props {
  title: string;
  subtitle: string;
  mood?: LokaMood;
  children: React.ReactNode;
}

// kerangka halaman masuk/daftar/lupa sandi: latar (gambar kalo ada), lalu kartu berisi Loka + judul + isi.
// Semua teks ada DI DALAM kartu yg solid, jadi gambar latar apa pun tetap aman terbaca
export default function AuthShell({ title, subtitle, mood = "happy", children }: Props) {
  return (
    <main
      className="min-h-screen flex items-center justify-center p-4 py-8 relative"
      style={AUTH_BG ? { backgroundImage: `url(${AUTH_BG})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
    >
      {AUTH_BG && <div aria-hidden="true" className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(42,36,51,0.18), rgba(42,36,51,0.44))" }} />}
      <div className="relative w-full max-w-md gamiz-card overflow-hidden">
        <NusantaraPatternStrip vibe="majapahit" height={16} />
        <div className="relative p-5 sm:p-6 space-y-4">
          <NusantaraCornerFrame size={26} />
          <div className="relative z-10 text-center space-y-1">
            <div className="flex justify-center">
              <Loka size={88} mood={mood} />
            </div>
            <h1 className="font-display text-2xl font-extrabold text-alabaster">{title}</h1>
            <p className="text-sm text-pebble leading-snug">{subtitle}</p>
          </div>
          <NusantaraDivider className="relative z-10" />
          <div className="relative z-10 space-y-4">{children}</div>
        </div>
        <NusantaraPatternStrip vibe="majapahit" height={10} />
      </div>
    </main>
  );
}
