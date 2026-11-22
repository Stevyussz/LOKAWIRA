"use client";

import { useEffect } from "react";
import Link from "next/link";
import Loka from "@/components/brand/Loka";
import { NusantaraCornerFrame, NusantaraDivider, NusantaraPatternStrip } from "@/components/brand/NusantaraOrnaments";

// batas galat tingkat halaman: tampilan gak boleh putih kosong kalo ada kompponen yg gagal
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div role="alert" className="gamiz-card max-w-sm w-full overflow-hidden">
        <NusantaraPatternStrip vibe="majapahit" height={16} />
        <div className="relative p-6 text-center space-y-4">
          <NusantaraCornerFrame size={24} />
          <div className="relative z-10 flex justify-center"><Loka size={96} mood="oops" motion="wiggle" /></div>
          <h1 className="relative z-10 font-display text-2xl font-extrabold text-alabaster">Ada yang tidak beres</h1>
          <NusantaraDivider className="relative z-10" />
          <p className="relative z-10 text-sm text-pebble">
            Halaman ini gagal dimuat. Datamu aman. Coba muat ulang, dan kalau masih sama, kembali ke peta.
          </p>
          <div className="relative z-10 flex flex-wrap justify-center gap-2">
            <button type="button" onClick={reset} className="btn-tactile-primary min-h-[48px] px-5 text-sm">
              Coba lagi
            </button>
            <Link href="/" className="btn-tactile-secondary min-h-[48px] px-5 text-sm inline-flex items-center">
              Kembali ke peta
            </Link>
          </div>
        </div>
        <NusantaraPatternStrip vibe="majapahit" height={10} />
      </div>
    </main>
  );
}
