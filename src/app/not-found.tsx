import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="gamiz-card max-w-sm w-full p-6 text-center space-y-4">
        <h1 className="font-display text-2xl font-extrabold text-alabaster">Jalur ini tidak ada di peta</h1>
        <p className="text-sm text-pebble">Alamat yang kamu tuju tidak ditemukan.</p>
        <Link href="/" className="btn-tactile-primary min-h-[48px] px-5 text-sm inline-flex items-center">
          Kembali ke peta
        </Link>
      </div>
    </main>
  );
}
