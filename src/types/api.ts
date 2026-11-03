import {
  AuthUser,
  MerchantStatus,
  OpkCategory,
  SpotType,
  UnlockedLoreCard,
  CulturalSpot,
  CulturalVibe,
  IssuedVoucher,
  LensVerificationResult,
  ReservationPass,
  ReferenceImage,
} from "@/types/lokawira";

// Kontrak antr frontend & backend - Satu-satunya tempat beentuk request/response didefinisikan

export interface AiTrainingNote {
  id: string;
  opkCategory: string;
  maestroSource: string;
  summary: string;
  updatedAt: string;
}

// GET /api/spots?vibe=
export interface SnapshotResponse {
  spots: CulturalSpot[];
  vouchers: IssuedVoucher[];
  reservations: ReservationPass[];
  aiTrainingNotes: AiTrainingNote[];
  // usulan: ada kalo masih ada halaman berikutnya
  nextCursor?: string;
}

export type SnapshotQuery = { vibe?: CulturalVibe; limit?: number; cursor?: string };

// POST /api/spots {action:"UPDATE_QUOTA"}
export interface UpdateQuotaRequest {
  spotId: string;
  currentVisitors: number;
}
export interface UpdateQuotaResponse {
  spot: CulturalSpot;
  spots: CulturalSpot[];
}

// POST /api/spots {action:"ADD_SPOT"}
export interface AddSpotResponse {
  spot: CulturalSpot;
  spots: CulturalSpot[];
}

// POST /api/spots {action:"ADD_AI_NOTE"}
export interface AddAiNoteRequest {
  opkCategory: string;
  maestroSource: string;
  summary: string;
}
export interface AddAiNoteResponse {
  aiTrainingNotes: AiTrainingNote[];
}

// POST /api/reservations
export interface CreateReservationRequest {
  spotId: string;
  visitorName: string;
  partySize: number;
  scheduledSlot: string;
  acceptCircularQuest: boolean;
}
export interface CreateReservationResponse {
  reservation: ReservationPass;
  bonusVoucher?: IssuedVoucher;
  reservations: ReservationPass[];
  vouchers: IssuedVoucher[];
}

// POST /api/vouchers/redeem
export interface RedeemVoucherResponse {
  redeemedVoucher: IssuedVoucher;
  vouchers: IssuedVoucher[];
}

// POST /api/ai/lens-verify
export interface LensVerifyRequest {
  sampleId: string;
  spotId: string;
  customImageName?: string;
}
export type LensVerifyResponse = LensVerificationResult;

// POST /api/ai/storyteller
export interface StorytellerRequest {
  spotId: string;
  customQuestion?: string;
}
export interface StorytellerResponse {
  spotId: string;
  spotName: string;
  opkCategory: string;
  verifiedSource: string;
  riddleTitle: string;
  isVerified: boolean;
  sourceMode: string;
  story: string;
  riddle: string;
}

// bentuk galat yg diharapkan dr smua endpoint (status 4xx/5xx)
export interface ApiErrorBody {
  error: string;
  // Opsional: kode mesin yg sabil, mis - "VOUCHER_ALREADY_REDEEMED"
  code?: string;
  // opsional: data tambahan, mis { distanceMeters: 340 } buat OUT_OF_RANGE
  details?: Record<string, unknown>;
}

// POST /api/auth/login
export interface LoginRequest {
  email: string;
  password: string;
}
// POST /api/auth/login & /api/auth/register - kalo backend pake cookie httpOnly, token boleh ksong
export interface AuthSessionResponse {
  token?: string;
  user: AuthUser;
}
// POST /api/auth/register - Admin gak bisa mendaftar senidri
export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  role: "VISITOR" | "MERCHANT";
}
// GET /api/auth/me
export interface MeResponse {
  user: AuthUser;
}

// POST /api/spots {action:"UPDATE_PROMO"}: mitra mengatur promo vuocer Object Scanner utk lapaknya
export interface UpdatePromoRequest {
  spotId: string;
  discountTitle: string;
  discountAmount: number;
  minimumSpend: number;
  // cuma diiterima dr ADMIN - Diabaikan utk MERCHANT
  rewardPoints?: number;
}
export interface UpdatePromoResponse {
  spot: CulturalSpot;
  spots: CulturalSpot[];
}

// POST /api/checkins: pengunjung check-in - XP ditentukan serer
export interface CheckInRequest {
  spotId: string;
  // usulan geofence: wajib kalo server nyalain cek jarak
  lat?: number;
  lng?: number;
  accuracyMeters?: number;
}
export interface CheckInResponse {
  checkIn: { id: string; code: string; spotId: string; createdAt: string };
  awardedPoints: number;
}

// POST /api/checkins/verify: mitra memverifikasi kode kehadran di lapaknya (sekali pakai)
export interface VerifyCheckInRequest {
  code: string;
}
export interface VerifyCheckInResponse {
  verified: boolean;
  spotId: string;
  spotName: string;
  awardedPoints: number;
}

// POST /api/reservations/checkin: pengelola menandai E-Ticket dipakai masuk
export interface TicketCheckInRequest {
  ticketId: string;
}
export interface TicketCheckInResponse {
  reservation: ReservationPass;
  reservations: ReservationPass[];
}

// =====================================================================
// KONTRAK USULAN (belum dipake UI). Detailnya ada di BACKEND_INTEGRATION
// bagian 7. Kalo ada yg diubah, ubah di sini dulu trus kabarin gw.
// =====================================================================

// GET /api/me/profile (login). xp & level punya server buat user yg login
export interface ProfileResponse {
  xp: number;
  // level = floor(xp / 150) + 1
  level: number;
  checkedInSpotIds: string[];
  loreCards: UnlockedLoreCard[];
  vouchers: IssuedVoucher[];
  reservations: ReservationPass[];
}

// PATCH /api/spots/{id}: kirim field yg mau diubah aja
export interface UpdateSpotRequest {
  name?: string;
  address?: string;
  facilities?: string[];
  coordinates?: { lat: number; lng: number };
  quota?: { maxCapacity?: number };
  quest?: {
    riddleTitle?: string;
    riddleClue?: string;
    loreNarrative?: string;
    targetObjectPrompt?: string;
    // dua ini cuma diterima dari ADMIN
    verifiedLoreSource?: string;
    rewardPoints?: number;
  };
  // field di bawah ini cuma diterima dari ADMIN
  spotType?: SpotType;
  opkCategory?: OpkCategory;
  vibe?: CulturalVibe;
  regionName?: string;
}
export interface UpdateSpotResponse {
  spot: CulturalSpot;
  spots: CulturalSpot[];
}

// DELETE /api/spots/{id}: soft delete (ARCHIVED)
export interface DeleteSpotResponse {
  spots: CulturalSpot[];
}

// GET /api/admin/merchants?status=&limit=&cursor=
export interface MerchantSummary {
  id: string;
  name: string;
  email: string;
  status: MerchantStatus;
  createdAt: string;
  spotCount: number;
}
export interface ListMerchantsResponse {
  merchants: MerchantSummary[];
  nextCursor?: string;
}
// POST /api/admin/merchants/{id}/approve | /reject
export interface RejectRequest {
  reason?: string;
}
export interface MerchantDecisionResponse {
  merchant: MerchantSummary;
}

// POST /api/admin/spots/{id}/review
export interface SpotReviewRequest {
  decision: "PUBLISH" | "REJECT";
  reason?: string;
}
export interface SpotReviewResponse {
  spot: CulturalSpot;
  spots: CulturalSpot[];
}

// akun: semua balikin { ok: true }
export interface VerifyEmailRequest {
  token: string;
}
export interface ForgotPasswordRequest {
  email: string;
}
export interface ResetPasswordRequest {
  token: string;
  // min 8 karakter
  password: string;
}
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}
// DELETE /api/me
export interface DeleteAccountRequest {
  password: string;
}
export interface OkResponse {
  ok: true;
}

// GET /api/admin/reservations dan /api/admin/vouchers
export interface AdminListQuery {
  spotId?: string;
  status?: string;
  from?: string;
  to?: string;
  limit?: number;
  cursor?: string;
}
export interface AdminReservationsResponse {
  reservations: ReservationPass[];
  nextCursor?: string;
}
export interface AdminVouchersResponse {
  vouchers: IssuedVoucher[];
  nextCursor?: string;
}

// POST /api/spots/{id}/reference-images (multipart, field "image") dan DELETE /api/spots/{id}/reference-images/{imageId}
export interface ReferenceImagesResponse {
  referenceImages: ReferenceImage[];
}

// GET /api/health
export interface HealthResponse {
  ok: true;
  version: string;
  // ISO 8601
  time: string;
  // cuma diisi kalo server mewajibkan jarak buat check-in. Klien nahan tombol Check-In sblm user cukup dekat
  checkInRadiusMeters?: number;
}
