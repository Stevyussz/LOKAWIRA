import { CulturalSpot } from "@/types/lokawira";
import type {
  AddAiNoteRequest,
  UpdateAiNoteRequest,
  RegionInput,
  RegionsResponse,
  AdminListQuery,
  AdminReservationsResponse,
  AdminVouchersResponse,
  AddAiNoteResponse,
  AddSpotResponse,
  ApiErrorBody,
  AuthSessionResponse,
  CheckInRequest,
  CheckInResponse,
  LoginRequest,
  MeResponse,
  ProfileResponse,
  RegisterRequest,
  TicketCheckInRequest,
  TicketCheckInResponse,
  UpdatePromoRequest,
  UpdatePromoResponse,
  VerifyCheckInRequest,
  VerifyCheckInResponse,
  CreateReservationRequest,
  ChangePasswordRequest,
  DeleteAccountRequest,
  DeleteSpotResponse,
  ForgotPasswordRequest,
  HealthResponse,
  OkResponse,
  ReferenceImagesResponse,
  ResetPasswordRequest,
  ListMerchantsResponse,
  MerchantDecisionResponse,
  RejectRequest,
  SpotReviewRequest,
  SpotReviewResponse,
  UpdateSpotRequest,
  UpdateSpotResponse,
  CreateReservationResponse,
  LensVerifyRequest,
  LensVerifyResponse,
  RedeemVoucherResponse,
  SnapshotQuery,
  SnapshotResponse,
  StorytellerRequest,
  StorytellerResponse,
  UpdateQuotaRequest,
  UpdateQuotaResponse,
} from "@/types/api";

// Satu-satunya pintu frontend ke bakcend - Komponen gak boleh memanggil fetch langsung
export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");
// aman scr default: di build produksi, mode demo cuma menyala kalo NEXT_PUBLIC_DEMO_MODE=true diisi scr eksplisit
export const DEMO_MODE =
  process.env.NEXT_PUBLIC_DEMO_MODE !== undefined
    ? process.env.NEXT_PUBLIC_DEMO_MODE === "true"
    : process.env.NODE_ENV !== "production";
const CREDENTIALS: RequestCredentials =
  process.env.NEXT_PUBLIC_API_CREDENTIALS === "include" ? "include" : "same-origin";
const DEFAULT_TIMEOUT_MS = 15000;

export type ApiErrorKind = "network" | "timeout" | "http" | "parse";

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number;
  readonly code?: string;
  // data tambahan dari server, mis { distanceMeters: 340 } buat OUT_OF_RANGE
  readonly details?: Record<string, unknown>;

  constructor(kind: ApiErrorKind, message: string, status = 0, code?: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
    this.code = code;
    this.details = details;
  }

  // true kalo server gak terjangkau (bkn penolakan dr server)
  get isOffline(): boolean {
    return this.kind === "network" || this.kind === "timeout";
  }
}

let tokenProvider: (() => string | null) | null = null;

// dipanggil seali pas login tersedia: setAuthTokenProvider(() => session.token)
export function setAuthTokenProvider(fn: (() => string | null) | null) {
  tokenProvider = fn;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  timeoutMs?: number;
  signal?: AbortSignal;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, timeoutMs = DEFAULT_TIMEOUT_MS, signal } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  signal?.addEventListener("abort", () => controller.abort());

  const headers: Record<string, string> = {};
  // FormData: biarkan peramban ngisi Content-Type + boundary sendiri
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  if (body !== undefined && !isForm) headers["Content-Type"] = "application/json";
  const token = tokenProvider?.();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      credentials: CREDENTIALS,
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    if (controller.signal.aborted) {
      throw new ApiError("timeout", "Server terlalu lama menjawab. Coba lagi sebentar.");
    }
    throw new ApiError("network", "Server tidak terjangkau. Periksa koneksi internetmu.");
  } finally {
    clearTimeout(timer);
  }

  let payload: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      if (res.ok) throw new ApiError("parse", "Jawaban server tidak bisa dibaca.", res.status);
    }
  }

  if (!res.ok) {
    const e = (payload ?? {}) as Partial<ApiErrorBody>;
    throw new ApiError("http", e.error || `Permintaan ditolak server (${res.status}).`, res.status, e.code, e.details);
  }
  return payload as T;
}

// ?a=1&b=2 dari objek, field kosong dilewati
function toQuery(q: object): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q) as [string, unknown][]) if (v !== undefined && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export const api = {
  health: () => request<HealthResponse>("/api/health", { timeoutMs: 6000 }),

  getSnapshot: (q: SnapshotQuery = {}) =>
    request<SnapshotResponse>(`/api/spots${q.vibe ? `?vibe=${encodeURIComponent(q.vibe)}` : ""}`),

  updateQuota: (r: UpdateQuotaRequest) =>
    request<UpdateQuotaResponse>(`/api/spots/${encodeURIComponent(r.spotId)}/quota`, { method: "PATCH", body: { currentVisitors: r.currentVisitors } }),

  addSpot: (spot: CulturalSpot) =>
    request<AddSpotResponse>("/api/spots", { method: "POST", body: spot }),

  updateSpot: (id: string, r: UpdateSpotRequest) =>
    request<UpdateSpotResponse>(`/api/spots/${encodeURIComponent(id)}`, { method: "PATCH", body: r }),

  // foto contoh objek yg dipindai wisatawan (maks 5 per lapak)
  uploadReferenceImage: (spotId: string, image: Blob) => {
    const form = new FormData();
    form.append("image", image, "contoh.jpg");
    return request<ReferenceImagesResponse>(`/api/spots/${encodeURIComponent(spotId)}/reference-images`, { method: "POST", body: form, timeoutMs: 45000 });
  },

  deleteReferenceImage: (spotId: string, imageId: string) =>
    request<ReferenceImagesResponse>(`/api/spots/${encodeURIComponent(spotId)}/reference-images/${encodeURIComponent(imageId)}`, { method: "DELETE" }),

  deleteSpot: (id: string) =>
    request<DeleteSpotResponse>(`/api/spots/${encodeURIComponent(id)}`, { method: "DELETE" }),

  adminReservations: (q: AdminListQuery = {}) => request<AdminReservationsResponse>(`/api/admin/reservations${toQuery(q)}`),

  adminVouchers: (q: AdminListQuery = {}) => request<AdminVouchersResponse>(`/api/admin/vouchers${toQuery(q)}`),

  listMerchants: (status?: string) =>
    request<ListMerchantsResponse>(`/api/admin/merchants${status ? `?status=${encodeURIComponent(status)}` : ""}`),

  approveMerchant: (id: string) =>
    request<MerchantDecisionResponse>(`/api/admin/merchants/${encodeURIComponent(id)}/approve`, { method: "POST", body: {} }),

  rejectMerchant: (id: string, r: RejectRequest) =>
    request<MerchantDecisionResponse>(`/api/admin/merchants/${encodeURIComponent(id)}/reject`, { method: "POST", body: r }),

  reviewSpot: (id: string, r: SpotReviewRequest) =>
    request<SpotReviewResponse>(`/api/admin/spots/${encodeURIComponent(id)}/review`, { method: "POST", body: r }),

  addAiNote: (r: AddAiNoteRequest) =>
    request<AddAiNoteResponse>("/api/ai-notes", { method: "POST", body: r }),

  updateAiNote: (id: string, r: UpdateAiNoteRequest) =>
    request<AddAiNoteResponse>(`/api/ai-notes/${encodeURIComponent(id)}`, { method: "PATCH", body: r }),

  deleteAiNote: (id: string) =>
    request<AddAiNoteResponse>(`/api/ai-notes/${encodeURIComponent(id)}`, { method: "DELETE" }),

  listRegions: () => request<RegionsResponse>("/api/regions"),
  createRegion: (r: RegionInput) => request<RegionsResponse>("/api/regions", { method: "POST", body: r }),
  updateRegion: (id: string, r: RegionInput) =>
    request<RegionsResponse>(`/api/regions/${encodeURIComponent(id)}`, { method: "PATCH", body: r }),

  createReservation: (r: CreateReservationRequest) =>
    request<CreateReservationResponse>("/api/reservations", { method: "POST", body: r }),

  updatePromo: (r: UpdatePromoRequest) =>
    request<UpdatePromoResponse>(`/api/spots/${encodeURIComponent(r.spotId)}/promo`, {
      method: "PUT",
      body: { discountTitle: r.discountTitle, discountAmount: r.discountAmount, minimumSpend: r.minimumSpend, rewardPoints: r.rewardPoints },
    }),

  checkIn: (r: CheckInRequest) => request<CheckInResponse>("/api/checkins", { method: "POST", body: r }),

  verifyCheckIn: (r: VerifyCheckInRequest) =>
    request<VerifyCheckInResponse>("/api/checkins/verify", { method: "POST", body: r }),

  checkInTicket: (r: TicketCheckInRequest) =>
    request<TicketCheckInResponse>("/api/reservations/checkin", { method: "POST", body: r }),

  login: (r: LoginRequest) => request<AuthSessionResponse>("/api/auth/login", { method: "POST", body: r }),

  register: (r: RegisterRequest) => request<AuthSessionResponse>("/api/auth/register", { method: "POST", body: r }),

  me: () => request<MeResponse>("/api/auth/me"),

  getProfile: () => request<ProfileResponse>("/api/me/profile"),

  logout: () => request<{ ok: boolean }>("/api/auth/logout", { method: "POST", body: {} }),

  forgotPassword: (r: ForgotPasswordRequest) =>
    request<OkResponse & { demoToken?: string }>("/api/auth/forgot-password", { method: "POST", body: r }),

  resetPassword: (r: ResetPasswordRequest) =>
    request<OkResponse>("/api/auth/reset-password", { method: "POST", body: r }),

  // balikin token baru (sesi lama dicabut), backend asli boleh gak ngirim - pake cookie
  changePassword: (r: ChangePasswordRequest) =>
    request<OkResponse & { token?: string }>("/api/auth/change-password", { method: "POST", body: r }),

  deleteAccount: (r: DeleteAccountRequest) =>
    request<OkResponse>("/api/me", { method: "DELETE", body: r }),

  redeemVoucher: (code: string) =>
    request<RedeemVoucherResponse>("/api/vouchers/redeem", { method: "POST", body: { code } }),

  verifyLens: (r: LensVerifyRequest) =>
    request<LensVerifyResponse>("/api/ai/lens-verify", { method: "POST", body: r, timeoutMs: 30000 }),

  // versi upload: foto dikecilin dulu (src/lib/image.ts), server balas LensVerificationResult
  verifyLensImage: (spotId: string, image: Blob, where?: { lat: number; lng: number; accuracyMeters: number }) => {
    const form = new FormData();
    form.append("spotId", spotId);
    if (where) {
      form.append("lat", String(where.lat));
      form.append("lng", String(where.lng));
      form.append("accuracyMeters", String(where.accuracyMeters));
    }
    form.append("image", image, "scan.jpg");
    return request<LensVerifyResponse>("/api/ai/lens-verify", { method: "POST", body: form, timeoutMs: 45000 });
  },

  askStoryteller: (r: StorytellerRequest) =>
    request<StorytellerResponse>("/api/ai/storyteller", { method: "POST", body: r, timeoutMs: 30000 }),
};

// pesan galat yg aman ditampilkan ke user
export function describeError(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}
