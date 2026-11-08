export type CulturalVibe = "majapahit" | "sogan" | "bahari" | "tridatu" | "ukiran";

export type SurfaceTheme = "andesite" | "daylight";

// 10 Objek Pemajuan Kebudayaan (UU 5/2017 Pasal 5), plus Cagar Budaya (UU 11/2010, bkn OPK)
// buat titik yg wujudnya situs/bangunan cagar budaya
export type OpkCategory =
  | "Tradisi Lisan"
  | "Manuskrip"
  | "Adat Istiadat"
  | "Ritus"
  | "Pengetahuan Tradisional"
  | "Teknologi Tradisional"
  | "Seni"
  | "Bahasa"
  | "Permainan Rakyat"
  | "Olahraga Tradisional"
  | "Cagar Budaya";

export type SpotType = "PRIMARY_DEST" | "SANGGAR_SENI" | "UMKM_KULINER" | "UMKM_KRIYA";

// kawasan budaya: data (bkn kode). Dibuat & diaktifkan pengelola pusat. Lapak masuk kawasan otomatis dr lokasi pin
export interface Region {
  id: string;
  name: string; // nama pendek, mis "Majapahit"
  label: string; // lokasi, mis "Trowulan, Mojokerto"
  theme: CulturalVibe; // palet warna (1 dr 5), boleh dipake bareng kawasan lain
  center: { lat: number; lng: number };
  radiusKm: number; // lapak dlm radius ini masuk kawasan
  status: "ACTIVE" | "DRAFT"; // DRAFT gak tampil ke wisatawan
  createdAt?: string;
}

// jejak dampak anonim (tanpa data pribadi): poster QR dibuka, pengingat acara disimpan, pandu ke titik dimulai
export type MetricType = "QR_OPEN" | "REMINDER_SAVED" | "GUIDE_START";
export interface SpotImpact {
  spotId: string;
  spotName: string;
  regionId?: string;
  qrOpens: number;
  reminders: number;
  guides: number;
  checkIns: number;
  checkInsVerified: number;
  vouchersIssued: number;
  vouchersRedeemed: number;
  redeemedValue: number; // rupiah potongan yg beneran dipakai di kasir
  upcomingEvents: number;
}

// acara budaya di sebuah titik (pentas, latihan terbuka, kelas, pasar). Satu titik bisa punya banyak acara.
// repeat: NONE = sekali, WEEKLY = tiap minggu di hari & jam yg sama, MONTHLY_LAST = hari yg sama di minggu terakhir tiap bulan
export type EventRepeat = "NONE" | "WEEKLY" | "MONTHLY_LAST";
export interface CulturalEvent {
  id: string;
  spotId: string;
  title: string;
  description?: string;
  startsAt: string; // ISO, kemunculan pertama
  endsAt: string; // ISO, selesai kemunculan pertama
  repeat: EventRepeat;
  createdAt?: string;
}
// satu kemunculan acara di tanggal tertentu (hasil hitungan server dr pola berulang)
export interface EventOccurrence {
  eventId: string;
  spotId: string;
  spotName: string;
  regionId?: string;
  title: string;
  description?: string;
  startsAt: string;
  endsAt: string;
  repeat: EventRepeat;
}

// cara masuk titik: FREE = bebas masuk tanpa tiket (acara publik, warung), RESERVATION = gratis tapi pesan slot
// (kapasitas terbatas), TICKET = berbayar (harga & cara beli). Kosong = data lama (cagar utama RESERVATION, lainnya FREE)
export type EntryMode = "FREE" | "RESERVATION" | "TICKET";
export interface SpotEntry {
  mode: EntryMode;
  // cuma utk TICKET, rupiah
  priceIdr?: number;
  // mis. "Bayar di loket" atau "Tiket di situs resmi", maks 140 karakter
  note?: string;
}

// jam buka berulang. days: 0 = Minggu ... 6 = Sabtu (kosong = tiap hari). close <= open artinya lewat tengah malam
export interface OpeningHours {
  days: number[];
  open: string; // "HH:MM" waktu setempat
  close: string;
}

// acara sekali jalan (pentas, festival). Lewat endsAt = disembunyiin dr peta publik
export interface SpotEvent {
  startsAt: string; // ISO
  endsAt: string; // ISO
}

export type UserRole = "VISITOR" | "MERCHANT" | "ADMIN";

// status akun mitra: PENDING nunggu persetujuan admin (usulan, lihat BACKEND_INTEGRATION bagian 7)
export type MerchantStatus = "PENDING" | "ACTIVE" | "REJECTED";

// status titik: dari mitra mulai PENDING_REVIEW, dari admin langsung PUBLISHED (usulan)
export type SpotStatus = "PENDING_REVIEW" | "PUBLISHED" | "REJECTED" | "ARCHIVED";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  // cuma ada buat MERCHANT. kosong = dianggap ACTIVE (data lama)
  status?: MerchantStatus;
  // alasan dari pengelola kalo ditolak (usulan, opsional)
  statusReason?: string;
}

export interface CulturalSpot {
  id: string;
  // pemilik lapak (id user bertiipe MERCHANT) - Kosong utk titik milik pengelola
  ownerId?: string;
  // ISO 8601, diisi server pas titik dibuat - Titik bawaan tnpa nilai ini dianggap paling tua
  createdAt?: string;
  // kosong = dianggap PUBLISHED (data lama)
  status?: SpotStatus;
  // alasan dari pengelola kalo ditolak (usulan, opsional)
  statusReason?: string;
  name: string;
  regionName: string;
  // kawasan tempat titik ini (ditentukan server dr koordinat). Kosong = di luar semua kawasan, gak bisa terbit
  regionId?: string;
  // usulan nama kawasan dr mitra kalo lapaknya di luar semua kawasan
  regionProposal?: string;
  // palet warna, ngikut tema kawasannya
  vibe: CulturalVibe;
  spotType: SpotType;
  opkCategory: OpkCategory;
  coordinates: {
    lat: number;
    lng: number;
  };
  address: string;
  facilities: string[];
  // satu kalimat "kenapa layak mampir", diisi mitra/pengelola, maks 100 karakter
  highlight?: string;
  // info tempat (sheet Info): deskripsi singkat, peraturan pengunjung, kontak. Semua opsional
  description?: string;
  rules?: string[];
  contact?: string;
  // foto suasana tempat utk wisatawan (beda dgn referenceImages yg jadi kunci jawaban scan)
  gallery?: GalleryImage[];
  entry?: SpotEntry;
  openingHours?: OpeningHours;
  event?: SpotEvent;
  // zona waktu setempat; kosong = ditebak dr bujur (WIB/WITA/WIT)
  timeZone?: "Asia/Jakarta" | "Asia/Makassar" | "Asia/Jayapura";
  // Sistem Kuota & Antrean
  quota: {
    currentVisitors: number;
    maxCapacity: number;
    estimatedWaitMinutes: number;
    nextAvailableSlot: string;
  };
  // Sistem Quest & StoryTeller
  quest: {
    riddleTitle: string;
    riddleClue: string;
    targetObjectPrompt: string;
    verifiedLoreSource: string;
    loreNarrative: string;
    rewardPoints: number;
    voucherReward: {
      merchantName: string;
      discountTitle: string;
      discountAmount: number;
      minimumSpend: number;
    };
    // foto contoh objek yg dipindai wisatawan (diunggah mitra). Dipakai AI sbg pembanding
    referenceImages?: ReferenceImage[];
  };
}

export interface ReferenceImage {
  id: string;
  url: string;
}

export interface GalleryImage {
  id: string;
  url: string;
  // keterangan singkat foto, maks 80 karakter
  caption?: string;
}

export interface IssuedVoucher {
  code: string;
  signatureHash: string;
  spotId: string;
  merchantName: string;
  discountTitle: string;
  discountAmount: number;
  minimumSpend: number;
  // ISO 8601, atau null kalo gak kadaluarsa. Teks lama ("Berlaku 7 Hari") masih diterima UI
  expiresAt: string | null;
  status: "ACTIVE" | "REDEEMED";
  redeemedAt?: string;
  // ISO, kapan voucer terbit (buat hitung dampak)
  issuedAt?: string;
}

export interface ReservationPass {
  ticketId: string;
  spotId: string;
  spotName: string;
  visitorName: string;
  partySize: number;
  scheduledSlot: string;
  status: "CONFIRMED" | "CHECKED_IN";
  circularQuestAccepted: boolean;
  createdAt: string;
}

export interface UnlockedLoreCard {
  id: string;
  spotId: string;
  objectName: string;
  opkCategory: OpkCategory;
  verifiedSource: string;
  story: string;
  unlockedAt: string;
  confidenceScore: number;
}

export interface LensVerificationResult {
  isVerified: boolean;
  confidenceScore: number;
  detectedObjectName: string;
  culturalStory: string;
  opkReference: OpkCategory;
  verifiedSource: string;
  awardedPoints: number;
  issuedVoucher?: IssuedVoucher;
  // alasan buat user kalo isVerified false (objek gak dikenali), usulan
  message?: string;
  // kenapa gak ada XP/voucer walau objek cocok: tamu (perlu akun) atau udah klaim di titik ini hari ini
  rewardNote?: "LOGIN_FOR_REWARD" | "ALREADY_CLAIMED_TODAY";
}

export interface CulturalObjectSample {
  id: string;
  spotId: string;
  label: string;
  objectName: string;
  opkCategory: OpkCategory;
  verifiedSource: string;
  visualClue: string;
  storyResult: string;
  confidence: number;
}
