import Link from "next/link";
import Loka from "@/components/brand/Loka";
import { NusantaraCornerFrame, NusantaraDivider, NusantaraPatternStrip } from "@/components/brand/NusantaraOrnaments";
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
      "Pilih kawasan di kanan atas peta (Majapahit, Mataraman, Bahari, Tridatu, atau Toraja) untuk mencoba data contoh; warna peta, motif wastra, dan emblem kawasan ikut berganti. Kawasan sasaran uji lapangan kami, Pandhalungan (Jember), sudah disiapkan sebagai draf di Dasbor Pengelola beserta 5 rujukan budayanya.",
      "Ketuk tombol Jelajah di kanan peta untuk membuka Rute Jelajah Kawasan berurutan (mendukung moda jalan kaki dan sepeda motor). Ketuk sebuah titik, lalu Pandu aku untuk rute langsung ke satu titik.",
      "Check-In: dapat XP dan kode kehadiran KDR- untuk ditunjukkan ke pemilik lapak.",
      "Scan Objek: lihat objek yang dicari beserta foto contoh, unggah foto, lalu buka kartu kisah dan voucer LKW- (dilengkapi kode QR) yang tersimpan di Tas.",
      "Tiket (hanya di titik yang perlu pesan atau bertiket): pesan jam masuk untuk menerbitkan E-Ticket ber-QR. Bila lokasi utama padat dan misi pengalihan diterima, voucer dari UMKM terdekat ikut terbit. Titik bebas masuk menampilkan tombol Info berisi jam buka dan fasilitas.",
      "Hadiah dibatasi agar adil: XP dan voucer hanya untuk akun, sekali per titik per hari. Tanpa akun, kisah tetap bisa dibaca.",
      "Kisah: tanyakan sesuatu kepada Loka. Jawaban menyebut rujukan yang dipakai.",
      "Agenda: lihat acara budaya 30 hari ke depan di kawasan, lalu tekan Ingatkan aku untuk menyimpannya ke kalender HP. Kartu titik juga menampilkan acara berikutnya.",
      "Poster QR: buka alamat yang tercetak di poster lapak (bentuknya /?titik=<kode lapak>). Aplikasi langsung membuka lapak itu, seperti orang yang memindai poster saat lewat.",
      "Akun: pasang LOKAWIRA ke layar utama dan atur tingkat animasi.",
    ],
  },
  {
    icon: "umkm",
    title: "Mitra (UMKM dan sanggar)",
    who: "Masuk dengan akun mitra uji, lalu buka Dasbor Mitra.",
    steps: [
      "Kasir: ketik kode LKW- atau pindai QR voucer lewat kamera untuk menukar potongan, atau masukkan kode KDR- untuk memverifikasi kehadiran pengunjung. Setiap kode hanya berlaku sekali.",
      "Lapak Saya: daftarkan lapak baru. Lokasi bisa dicari lewat alamat atau lokasimu sekarang, dan kawasannya terdeteksi otomatis dari lokasi pin. Atur juga cara masuk (bebas, pesan slot, atau bertiket) dan jam buka. Lapak baru maupun perubahan objek scan/cerita menunggu review pengelola.",
      "Promo & Scan: tulis objek yang harus dipotret wisatawan, unggah foto contoh, dan atur nominal voucer.",
      "Acara di lapakmu: tambah pentas, latihan terbuka, atau kelas (sekali, tiap minggu, atau Minggu terakhir tiap bulan). Acara langsung tampil di Agenda wisatawan.",
      "Poster QR: cetak poster untuk dipasang di depan lapak. Kartu Dampak menunjukkan berapa kali poster dipindai, orang yang diarahkan ke lokasi, check-in, dan nilai voucer yang ditukar.",
    ],
  },
  {
    icon: "database",
    title: "Pengelola",
    who: "Masuk dengan akun pengelola uji, lalu buka Dasbor Pengelola.",
    steps: [
      "Dampak LOKAWIRA: lihat angka 30 hari per kawasan, Salin ringkasan, atau buka Laporan Resmi (PDF) untuk dokumen A4 siap cetak.",
      "Persetujuan: setujui atau tolak mitra baru dan lapak baru, atau nonaktifkan mitra (lapaknya ikut hilang dari peta publik).",
      "Kuota & Tiket: isi jumlah pengunjung. Di atas 85%, peta wisatawan menampilkan jalur pengalihan ke UMKM sekitar.",
      "Hadiah & Voucer: atur XP misi dan nominal voucer.",
      "Pengetahuan Loka: tambah rujukan budaya, lalu tanyakan topiknya kepada Loka di peta.",
      "Kawasan: buat kawasan baru (nama, lokasi, palet warna, titik pusat, radius) sebagai draf atau aktif. Lapak mitra di dalam radiusnya otomatis masuk kawasan itu.",
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
        <header className="gamiz-card overflow-hidden">
          <NusantaraPatternStrip vibe="majapahit" height={14} />
          <div className="relative p-5 sm:p-6 space-y-4">
            <NusantaraCornerFrame size={24} />
            <div className="relative z-10 flex items-start gap-4">
              <Loka size={72} mood="cheer" className="shrink-0" />
              <div className="space-y-2">
                <p className="text-xs font-extrabold text-vibePrimary">BUDAYA GO! 2026 · Tim Kurasi</p>
                <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-alabaster leading-tight">Panduan menguji LOKAWIRA</h1>
                <p className="text-sm text-pebble leading-relaxed">
                  Semua alur bisa dicoba dari jarak jauh. Syarat jarak ke lokasi (geofence) sengaja dimatikan selama penilaian dan dapat dinyalakan per kawasan saat uji lapangan. Akun uji untuk setiap peran tercantum di Lampiran G proposal.
                </p>
              </div>
            </div>
            <NusantaraDivider className="relative z-10" />
            <div className="relative z-10 flex flex-wrap gap-2.5">
              <Link href="/" className="btn-tactile-primary min-h-[48px] px-5 text-sm inline-flex items-center gap-2">
                <Icon name="map" size={18} />
                <span>Buka peta</span>
              </Link>
              <Link href="/masuk" className="btn-tactile-secondary min-h-[48px] px-5 text-sm inline-flex items-center gap-2">
                <Icon name="user" size={18} />
                <span>Masuk dengan akun uji</span>
              </Link>
            </div>
          </div>
        </header>

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
