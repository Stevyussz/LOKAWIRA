import Loka from "@/components/brand/Loka";

// ditampilin service worker kalo HP lagi gak ada sinyal & halaman belum pernah dibuka
export const metadata = { title: "Tidak ada sinyal · LOKAWIRA" };

export default function OfflinePage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="gamiz-card max-w-sm w-full p-6 text-center space-y-4">
        <div className="flex justify-center"><Loka size={96} mood="oops" /></div>
        <h1 className="font-display text-2xl font-extrabold text-alabaster">Sinyal sedang hilang</h1>
        <p className="text-sm text-pebble">
          LOKAWIRA butuh internet untuk peta, cerita Loka, dan voucer. Voucer dan tiket yang sudah tersimpan tetap aman. Cari sinyal, lalu coba lagi.
        </p>
        {/* sengaja <a>, bkn Link: harus muat ulang penuh biar service worker nyoba internet lagi */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" className="btn-tactile-primary min-h-[48px] px-5 text-sm inline-flex items-center">Coba lagi</a>
      </div>
    </main>
  );
}
