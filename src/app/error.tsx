"use client";

import { useEffect } from "react";
import Link from "next/link";
import Loka from "@/components/brand/Loka";

// batas galat tingkat halaman: tampilan gak boleh putih kosong kalo ada kompponen yg gagal
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div role="alert" className="gamiz-card max-w-sm w-full p-6 text-center space-y-4">
        <div className="flex justify-center"><Loka size={96} mood="oops" motion="wiggle" /></div>
        <h1 className="font-display text-2xl font-extrabold text-alabaster">Ada yang tidak beres</h1>
        <p className="text-sm text-pebble">
          Halaman ini gagal dimuat. Datamu aman. Coba muat ulang, dan kalau masih sama, kembali ke peta.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" onClick={reset} className="btn-tactile-primary min-h-[48px] px-5 text-sm">
            Coba lagi
          </button>
          <Link href="/" className="btn-tactile-secondary min-h-[48px] px-5 text-sm inline-flex items-center">
            Kembali ke peta
          </Link>
        </div>
      </div>
    </main>
  );
}
