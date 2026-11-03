export type CulturalVibe = "majapahit" | "sogan" | "bahari" | "tridatu" | "ukiran";

export type SurfaceTheme = "andesite" | "daylight";

export type OpkCategory =
  | "Tradisi Lisan"
  | "Pengetahuan Tradisional"
  | "Teknologi Tradisional & Kriya"
  | "Seni Pertunjukan"
  | "Adat Istiadat & Ritus" 
  | "Cagar Budaya"
  | "Manuskrif"
  | "Permainan Rakyat"
  | "Olahraga Tradisional"
  | "Bahasa";

export type SpotType = "PRIMARY_DEST" | "SANGGAR_SENI" | "UMKM_KULINER" | "UMKM_KRIYA";

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
  vibe: CulturalVibe;
  spotType: SpotType;
  opkCategory: OpkCategory;
  coordinates: {
    lat: number;
    lng: number;
  };
  address: string;
  facilities: string[];
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
