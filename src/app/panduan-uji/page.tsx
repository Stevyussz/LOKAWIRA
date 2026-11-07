import Link from "next/link";
import Loka from "@/components/brand/Loka";
import Icon, { type IconName } from "@/components/ui/Icon";

// panduan buat Tim Kurasi / juri: apa yg bisa dicoba per peran, tanpa harus datang ke lokasi
export const metadata = {
  title: "Panduan menguji · LOKAWIRA",
  description: "Langkah mencoba LOKAWIRA dari jarak jauh untuk Tim Kurasi BUDAYA GO! 2026.",
};

interface Section {
  icon: IconName;
  title: string;
  who: string;
  steps: string[];
}

const SECTIONS: Section[] = [
  {
    icon: "compass",
    title: "Wisatawan",
    who: "Bisa langsung tanpa akun. Masuk dengan akun wisatawan uji agar progres tersimpan.",
    steps: [
      "Geser, perbesar, dan perkecil peta (OpenStreetMap asli). Saat diperkecil, pin mengecil lalu bergabung menjadi lingkaran berangka.",
      "Pilih kawasan di atas peta (Majapahit, Sogan, Bahari, Tridatu, Ukiran). Warna peta dan aksen ikut berganti.",
      "Ketuk sebuah titik, lalu Pandu aku: rute jalan kaki penuh tampil dulu, kemudian Mulai untuk dipandu (perlu izin lokasi).",
      "Check-In: dapat XP dan kode kehadiran KDR- untuk ditunjukkan ke pemilik lapak.",
      "Scan Objek: lihat objek yang dicari beserta foto contoh, unggah foto, lalu buka kartu kisah dan voucer LKW- yang tersimpan di Tas.",
      "Tiket: pesan jam masuk. Bila lokasi utama padat dan misi pengalihan diterima, voucer dari UMKM terdekat ikut terbit.",
      "Kisah: tanyakan sesuatu kepada Loka. Jawaban menyebut rujukan yang dipakai.",
      "Akun: pasang LOKAWIRA ke layar utama dan atur tingkat animasi.",
    ],
  },
  {
    icon: "umkm",
    title: "Mitra (UMKM dan sanggar)",
    who: "Masuk dengan akun mitra uji, lalu buka Dasbor Mitra.",
    steps: [
      "Kasir: ketik kode LKW- untuk menukar voucer, atau KDR- untuk memverifikasi kehadiran pengunjung. Setiap kode hanya berlaku sekali.",
      "Lapak Saya: daftarkan lapak baru dalam 5 langkah. Lokasi bisa dicari lewat alamat atau lokasimu sekarang. Lapak baru menunggu review pengelola.",
      "Promo & Scan: tulis objek yang harus dipotret wisatawan, unggah foto contoh, dan atur nominal voucer.",
    ],
  },
  {
    icon: "database",
    title: "Pengelola",
    who: "Masuk dengan akun pengelola uji, lalu buka Dasbor Pengelola.",
    steps: [
      "Persetujuan: setujui atau tolak mitra baru dan lapak baru, atau nonaktifkan mitra (lapaknya ikut hilang dari peta publik).",
      "Kuota & Tiket: isi jumlah pengunjung. Di atas 85%, peta wisatawan menampilkan jalur pengalihan ke UMKM sekitar.",
      "Hadiah & Voucer: atur XP misi dan nominal voucer.",
      "Pengetahuan Loka: tambah rujukan budaya, lalu tanyakan topiknya kepada Loka di peta.",
    ],
  },
];

const FLOW = [
  "Sebagai wisatawan: Check-In di titik milik mitra uji, lalu Scan Objek di titik yang sama.",
  "Sebagai mitra: buka Kasir, masukkan kode KDR- (hadiah misi masuk ke akun wisatawan) dan kode LKW- (harga terpotong).",
  "Sebagai wisatawan: buka Akun dan lihat XP bertambah.",
];

export default function PanduanUjiPage() {
  return (
    <main className="min-h-screen px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="flex items-start gap-4">
          <Loka size={72} mood="cheer" className="shrink-0" />
          <div className="space-y-2">
            <p className="text-xs font-extrabold text-vibePrimary">BUDAYA GO! 2026 · Tim Kurasi</p>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-alabaster leading-tight">Panduan menguji LOKAWIRA</h1>
            <p className="text-sm text-pebble leading-relaxed">
              Semua alur bisa dicoba dari jarak jauh. Syarat jarak ke lokasi (geofence) sengaja dimatikan selama penilaian dan dapat dinyalakan per kawasan saat uji lapangan. Akun uji untuk setiap peran tercantum di Lampiran G proposal.
            </p>
          </div>
        </header>

        <div className="flex flex-wrap gap-2.5">
          <Link href="/" className="btn-tactile-primary min-h-[48px] px-5 text-sm inline-flex items-center gap-2">
            <Icon name="map" size={18} />
            <span>Buka peta</span>
          </Link>
          <Link href="/masuk" className="btn-tactile-secondary min-h-[48px] px-5 text-sm inline-flex items-center gap-2">
            <Icon name="user" size={18} />
            <span>Masuk dengan akun uji</span>
          </Link>
        </div>

        {SECTIONS.map((s) => (
          <section key={s.title} aria-labelledby={`sec-${s.icon}`} className="gamiz-card p-5 space-y-3">
            <div className="flex items-center gap-2.5">
              <span className="w-10 h-10 rounded-xl bg-obsidian flex items-center justify-center text-vibePrimary">
                <Icon name={s.icon} size={20} />
              </span>
              <div>
                <h2 id={`sec-${s.icon}`} className="text-base font-extrabold text-alabaster">{s.title}</h2>
                <p className="text-xs text-pebble">{s.who}</p>
              </div>
            </div>
            <ol className="space-y-2 list-decimal pl-5 marker:font-num marker:font-extrabold marker:text-vibePrimary">
              {s.steps.map((t) => (
                <li key={t} className="text-sm text-alabaster leading-relaxed pl-1">{t}</li>
              ))}
            </ol>
          </section>
        ))}

        <section aria-labelledby="sec-flow" className="rounded-2xl bg-obsidian p-5 space-y-3">
          <h2 id="sec-flow" className="text-base font-extrabold text-alabaster">Alur lengkap lintas peran (sekitar 3 menit)</h2>
          <ol className="space-y-2 list-decimal pl-5 marker:font-num marker:font-extrabold marker:text-vibePrimary">
            {FLOW.map((t) => (
              <li key={t} className="text-sm text-alabaster leading-relaxed pl-1">{t}</li>
            ))}
          </ol>
        </section>

        <p className="text-xs text-pebble leading-relaxed">
          Catatan: paling nyaman dicoba di ponsel. Data uji tersimpan di server percontohan dan dapat kembali ke kondisi awal saat server dimulai ulang.
        </p>
      </div>
    </main>
  );
}
