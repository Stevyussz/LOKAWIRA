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
  SpotEntry,
  CulturalEvent,
  EventOccurrence,
  MetricType,
  SpotImpact,
  EventRepeat,
  Region,
  OpeningHours,
  SpotEvent,
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
  // kawasan: publik cuma ACTIVE, pengelola semua (termasuk DRAFT)
  regions?: Region[];
  // usulan: ada kalo masih ada halaman berikutnya
  nextCursor?: string;
}

export type SnapshotQuery = { vibe?: CulturalVibe; limit?: number; cursor?: string };

// PATCH /api/spots/{spotId}/quota, body cuma currentVisitors (spotId dipake klien utk path)
export interface UpdateQuotaRequest {
  spotId: string;
  currentVisitors: number;
}
export interface UpdateQuotaResponse {
  spot: CulturalSpot;
  spots: CulturalSpot[];
}

// POST /api/spots, body = objek CulturalSpot
export interface AddSpotResponse {
  spot: CulturalSpot;
  spots: CulturalSpot[];
}

// PATCH /api/ai-notes/{id} (field opsional) dan DELETE /api/ai-notes/{id}, balasan sama kayak AddAiNoteResponse
export type UpdateAiNoteRequest = Partial<AddAiNoteRequest>;

// GET /api/regions, POST /api/regions, PATCH /api/regions/{id}
export interface RegionInput {
  name?: string;
  label?: string;
  theme?: CulturalVibe;
  center?: { lat: number; lng: number };
  radiusKm?: number;
  status?: "ACTIVE" | "DRAFT";
}
export interface RegionsResponse {
  regions: Region[];
  region?: Region;
  // jumlah lapak di luar kawasan yg otomatis masuk krn kawasan ini dibuat/diperluas
  adopted?: number;
}

// POST /api/metrics (anonim) & GET /api/metrics?days=&regionId= (mitra/admin)
export interface ImpactTotals {
  qrOpens: number;
  reminders: number;
  guides: number;
  checkIns: number;
  checkInsVerified: number;
  vouchersIssued: number;
  vouchersRedeemed: number;
  redeemedValue: number;
  upcomingEvents: number;
  spotsWithEvents: number;
  spots: number;
}
export interface ImpactResponse {
  days: number;
  totals: ImpactTotals;
  spots: SpotImpact[];
}

// GET /api/events, POST /api/events, DELETE /api/events/{id}
export interface EventsResponse {
  occurrences?: EventOccurrence[];
  // definisi acara yg boleh dikelola user ini (mitra/admin)
  events?: CulturalEvent[];
  event?: CulturalEvent;
}
export interface CreateEventRequest {
  spotId: string;
  title: string;
  description?: string;
  startsAt: string;
  endsAt: string;
  repeat: EventRepeat;
}

// POST /api/ai-notes
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
  // XP yg beneran ditambah server (0 kalo udah pesan di titik ini hari ini atau tamu)
  awardedPoints?: number;
  // alasan voucer pengalih gak terbit: tamu, udah klaim hari ini, atau gak ada mitra di kawasan
  rewardNote?: "LOGIN_FOR_REWARD" | "ALREADY_CLAIMED_TODAY" | "NO_PARTNER";
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
  // bukti lokasi: wajib kalo server nyalain geofence (LOCATION_REQUIRED), kalo gak diabaikan
  lat?: number;
  lng?: number;
  accuracyMeters?: number;
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
  // semua sumber yg dipakai Loka buat jawaban ini (narasi titik + rujukan Pengetahuan Loka)
  references?: string[];
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

// PUT /api/spots/{spotId}/promo (spotId utk path, bukan body): mitra mengatur promo vuocer Object Scanner utk lapaknya
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
  // false = pengunjung tamu: kehadiran sah, tapi XP gak bisa dicatat
  visitorHasAccount?: boolean;
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
  // mitra & admin. null = hapus. highlight "" = hapus
  highlight?: string;
  entry?: SpotEntry | null;
  openingHours?: OpeningHours | null;
  // field di bawah ini cuma diterima dari ADMIN
  event?: SpotEvent | null;
  spotType?: SpotType;
  opkCategory?: OpkCategory;
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
