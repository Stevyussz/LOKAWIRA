import Loka from "@/components/brand/Loka";
import { NusantaraCornerFrame, NusantaraDivider, NusantaraPatternStrip } from "@/components/brand/NusantaraOrnaments";

// ditampilin service worker kalo HP lagi gak ada sinyal & halaman belum pernah dibuka
export const metadata = { title: "Tidak ada sinyal · LOKAWIRA" };

export default function OfflinePage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="gamiz-card max-w-sm w-full overflow-hidden">
        <NusantaraPatternStrip vibe="majapahit" height={16} />
        <div className="relative p-6 text-center space-y-4">
          <NusantaraCornerFrame size={24} />
          <div className="relative z-10 flex justify-center"><Loka size={96} mood="oops" /></div>
          <h1 className="relative z-10 font-display text-2xl font-extrabold text-alabaster">Sinyal sedang hilang</h1>
          <NusantaraDivider className="relative z-10" />
          <p className="relative z-10 text-sm text-pebble">
            LOKAWIRA butuh internet untuk peta, cerita Loka, dan voucer. Voucer dan tiket yang sudah tersimpan tetap aman. Cari sinyal, lalu coba lagi.
          </p>
          {/* sengaja <a>, bkn Link: harus muat ulang penuh biar service worker nyoba internet lagi */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" className="relative z-10 btn-tactile-primary min-h-[48px] px-5 text-sm inline-flex items-center">Coba lagi</a>
        </div>
        <NusantaraPatternStrip vibe="majapahit" height={10} />
      </div>
    </main>
  );
}
