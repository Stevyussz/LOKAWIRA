import "dotenv/config";
import crypto from "node:crypto";
import Fastify, { FastifyReply, FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import nodemailer from "nodemailer";
import { z } from "zod";
import type { AuthUser, CulturalSpot, IssuedVoucher, MerchantStatus, ReservationPass, UnlockedLoreCard, UserRole } from "../../src/types/lokawira";
import { generateCulturalStoryAndValidation } from "../../src/lib/nineRouterClient";
import { INITIAL_CULTURAL_SPOTS } from "../../src/lib/seedCulturalData";
import { pool, closePool, migrate } from "./db.js";

const app = Fastify({ logger: true, bodyLimit: 6 * 1024 * 1024, trustProxy: true });
const SESSION_DAYS = 30;
const GEOfENCE = process.env.GEOFENCE_ENABLED === "true";
const RADIUS = Number(process.env.GEOFENCE_RADIUS_METERS) || 100;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const roles = ["VISITOR", "MERCHANT", "ADMIN"] as const;

type UserRow = AuthUser & { status_reason: string | null; password_salt: string; password_hash: string; email_verified: boolean; created_at: string };
type EntityRow<T> = { id: string; kind: string; owner_id: string | null; payload: T; file_data?: Buffer; mime_type?: string };
type RequestWithUser = FastifyRequest & { authUser: AuthUser | null; sessionToken: string | null };

declare module "fastify" {
  interface FastifyRequest {
    authUser: AuthUser | null;
    sessionToken: string | null;
  }
}

const schemas = {
  login: z.object({ email: z.string().email(), password: z.string().min(1) }),
  register: z.object({ name: z.string().trim().min(2), email: z.string().email(), password: z.string().min(8), role: z.enum(["VISITOR", "MERCHANT"]) }),
  reservation: z.object({ spotId: z.string().min(1), visitorName: z.string().trim().min(1), partySize: z.coerce.number().int().min(1).max(6), scheduledSlot: z.string().optional(), acceptCircularQuest: z.boolean().default(false) }),
  code: z.object({ code: z.string().trim().min(1) }),
  password: z.string().min(8),
};

function error(reply: FastifyReply, status: number, message: string, code?: string, details?: Record<string, unknown>) {
  return reply.code(status).send({ error: message, ...(code ? { code } : {}), ...(details ? { details } : {}) });
}
function bad(reply: FastifyReply, message = "Data yang dikirim belum valid.") { return error(reply, 400, message, "BAD_REQUEST"); }
function id(prefix: string) { return `${prefix}-${crypto.randomUUID()}`; }
function sha(value: string) { return crypto.createHash("sha256").update(value).digest("hex"); }
function hashPassword(password: string, salt: string) { return crypto.scryptSync(password, salt, 64).toString("hex"); }
function safeUser(row: UserRow): AuthUser {
  return { id: row.id, name: row.name, email: row.email, role: row.role, ...(row.role === "MERCHANT" ? { status: (row.status ?? "ACTIVE") as MerchantStatus, ...(row.status_reason ? { statusReason: row.status_reason } : {}) } : {}) };
}
function rawCookie(request: FastifyRequest) {
  const cookies = request.headers.cookie?.split(";").map((part) => part.trim()) ?? [];
  return cookies.find((part) => part.startsWith("lokawira.session="))?.slice("lokawira.session=".length) ?? null;
}
function requestUser(request: FastifyRequest) { return (request as RequestWithUser).authUser; }
function currentSession(request: FastifyRequest) { return (request as RequestWithUser).sessionToken; }
function requireRoles(request: FastifyRequest, reply: FastifyReply, allowed: UserRole[]) {
  const user = requestUser(request);
  if (!user) { error(reply, 401, "Silakan masuk terlebih dahulu.", "UNAUTHENTICATED"); return null; }
  if (!allowed.includes(user.role)) { error(reply, 403, "Akunmu tidak punya izin untuk aksi ini.", "FORBIDDEN"); return null; }
  if (user.role === "MERCHANT" && user.status !== "ACTIVE") {
    error(reply, 403, user.status === "PENDING" ? "Akun mitramu masih menunggu persetujuan pengelola." : "Pendaftaran mitramu ditolak pengelola.", "ACCOUNT_NOT_APPROVED");
    return null;
  }
  return user;
}
async function getEntity<T>(kind: string, entityId: string): Promise<EntityRow<T> | null> {
  const result = await pool.query<EntityRow<T>>("SELECT id, kind, owner_id, payload, file_data, mime_type FROM entities WHERE kind = $1 AND id = $2", [kind, entityId]);
  return result.rows[0] ?? null;
}
async function listEntities<T>(kind: string): Promise<EntityRow<T>[]> {
  const result = await pool.query<EntityRow<T>>("SELECT id, kind, owner_id, payload FROM entities WHERE kind = $1 ORDER BY created_at DESC", [kind]);
  return result.rows;
}
async function saveEntity<T>(kind: string, entityId: string, payload: T, ownerId: string | null = null) {
  await pool.query("INSERT INTO entities(id, kind, owner_id, payload) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET kind=EXCLUDED.kind, owner_id=EXCLUDED.owner_id, payload=EXCLUDED.payload", [entityId, kind, ownerId, JSON.stringify(payload)]);
}
async function getSpot(spotId: string) { return getEntity<CulturalSpot>("spot", spotId); }
async function allSpots() { return (await listEntities<CulturalSpot>("spot")).map((row) => row.payload); }
async function isOwner(user: AuthUser, spot: EntityRow<CulturalSpot>) { return user.role === "ADMIN" || spot.owner_id === user.id; }
async function visibleSpots(user: AuthUser | null) {
  const spots = await listEntities<CulturalSpot>("spot");
  const users = await pool.query<{ id: string; status: string | null }>("SELECT id,status FROM users WHERE role='MERCHANT'");
  const statuses = new Map(users.rows.map((row) => [row.id, row.status ?? "ACTIVE"]));
  return spots.filter(({ payload: spot, owner_id }) => {
    if (spot.status === "ARCHIVED") return false;
    const privileged = user?.role === "ADMIN" || (!!user && owner_id === user.id);
    if (owner_id && statuses.get(owner_id) !== "ACTIVE" && !privileged) return false;
    return !spot.status || spot.status === "PUBLISHED" || privileged;
  });
}
async function spotVisibleTo(user: AuthUser | null, spotId: string) {
  return (await visibleSpots(user)).some((row) => row.id === spotId);
}
async function profile(userId: string) {
  await pool.query("INSERT INTO profiles(user_id) VALUES($1) ON CONFLICT DO NOTHING", [userId]);
  const result = await pool.query<{ xp: number; lore_cards: UnlockedLoreCard[] }>("SELECT xp,lore_cards FROM profiles WHERE user_id=$1", [userId]);
  return result.rows[0];
}
async function addXp(userId: string | null, points: number) {
  if (!userId || points <= 0) return;
  await pool.query("INSERT INTO profiles(user_id,xp) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET xp=profiles.xp+EXCLUDED.xp", [userId, points]);
}
async function ownedRecords(kind: "voucher" | "reservation", user: AuthUser | null) {
  const rows = await listEntities<IssuedVoucher | ReservationPass>(kind);
  if (!user) return [];
  if (user.role === "ADMIN") return rows.map((row) => row.payload);
  if (user.role === "MERCHANT" && kind === "voucher") {
    const ownedIds = new Set((await pool.query("SELECT id FROM entities WHERE kind='spot' AND owner_id=$1", [user.id])).rows.map((row) => row.id));
    return rows.filter((row) => ownedIds.has((row.payload as IssuedVoucher).spotId)).map((row) => row.payload);
  }
  return rows.filter((row) => row.owner_id === user.id).map((row) => row.payload);
}
function estimatedWait(current: number, capacity: number) {
  const ratio = capacity ? current / capacity : 0;
  return ratio >= 0.85 ? 35 : ratio >= 0.6 ? 15 : 0;
}
function codeNumber(prefix: string) { return `${prefix}-${crypto.randomInt(100000, 1000000)}`; }
function imageSignatureMatches(type: string, data: Buffer) {
  if (type === "image/jpeg") return data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  if (type === "image/png") return data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (type === "image/webp") return data.length >= 12 && data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WEBP";
  return false;
}
async function uniqueCode(kind: string, prefix: string, field: "code" | "ticketId") {
  for (let attempt = 0; attempt < 12; attempt++) {
    const code = codeNumber(prefix);
    const found = await pool.query("SELECT 1 FROM entities WHERE kind=$1 AND payload->>$2=$3", [kind, field, code]);
    if (!found.rowCount) return code;
  }
  throw new Error("Tidak bisa membuat kode unik.");
}
function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = (value: number) => value * Math.PI / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
function geofence(reply: FastifyReply, where: { lat?: unknown; lng?: unknown; accuracyMeters?: unknown }, spot: CulturalSpot, action: string) {
  if (!GEOfENCE) return false;
  if (where.lat == null || where.lng == null || where.lat === "" || where.lng === "") { error(reply, 400, `Lokasi dibutuhkan untuk ${action} di titik ini.`, "LOCATION_REQUIRED"); return true; }
  const lat = Number(where.lat); const lng = Number(where.lng); const accuracy = Number(where.accuracyMeters);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) { error(reply, 400, "Koordinat tidak valid.", "LOCATION_REQUIRED"); return true; }
  if (!Number.isFinite(accuracy) || accuracy > 100) { error(reply, 400, "Sinyal GPS kurang tepat. Pindah ke area terbuka.", "LOCATION_TOO_INACCURATE"); return true; }
  const meters = distanceMeters({ lat, lng }, spot.coordinates);
  if (meters > RADIUS) { error(reply, 403, "Kamu belum cukup dekat dengan titik ini.", "OUT_OF_RANGE", { distanceMeters: Math.round(meters), radiusMeters: RADIUS }); return true; }
  return false;
}
async function paginated<T>(kind: string, request: FastifyRequest, predicate: (row: EntityRow<T>) => boolean = () => true) {
  const query = request.query as Record<string, string | undefined>;
  const limit = Math.max(1, Math.min(100, Number(query.limit) || 10));
  const rows = (await listEntities<T>(kind)).filter(predicate);
  const offset = query.cursor ? Number(Buffer.from(query.cursor, "base64url").toString("utf8")) : 0;
  const slice = rows.slice(Number.isFinite(offset) ? offset : 0, (Number.isFinite(offset) ? offset : 0) + limit);
  const next = offset + slice.length < rows.length ? Buffer.from(String(offset + slice.length)).toString("base64url") : undefined;
  return { rows: slice, ...(next ? { nextCursor: next } : {}) };
}
async function consumeRateLimit(key: string, limit: number, windowSeconds: number) {
  const result = await pool.query<{ allowed: boolean }>(
    "INSERT INTO rate_limits(key,count,reset_at) VALUES($1,1,now()+($3::text||' seconds')::interval) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN rate_limits.reset_at<now() THEN 1 ELSE rate_limits.count+1 END,reset_at=CASE WHEN rate_limits.reset_at<now() THEN now()+($3::text||' seconds')::interval ELSE rate_limits.reset_at END RETURNING count <= $2 AS allowed",
    [key, limit, windowSeconds]
  );
  return result.rows[0]?.allowed === true;
}

function deepMerge(target: Record<string, unknown>, patch: Record<string, unknown>) {
  for (const [key, value] of Object.entries(patch)) {
    if (value && typeof value === "object" && !Array.isArray(value) && target[key] && typeof target[key] === "object" && !Array.isArray(target[key])) {
      deepMerge(target[key] as Record<string, unknown>, value as Record<string, unknown>);
    } else target[key] = value;
  }
  return target;
}

app.decorateRequest("authUser", null);
app.decorateRequest("sessionToken", null);
app.register(cors, {
  origin(origin, callback) {
    const allowed = (process.env.CORS_ORIGINS ?? "http://localhost:3000").split(",").map((item) => item.trim());
    if (!origin || allowed.includes(origin)) callback(null, true);
    else callback(new Error("Origin tidak diizinkan."), false);
  },
  credentials: process.env.SESSION_MODE === "cookie",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Authorization", "Content-Type"],
});
app.register(multipart, { limits: { fileSize: MAX_IMAGE_BYTES, files: 1 } });
app.addHook("onRequest", async (request, reply) => {
  if (process.env.SESSION_MODE === "cookie" && !["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const origin = request.headers.origin;
    const allowed = (process.env.CORS_ORIGINS ?? "http://localhost:3000").split(",").map((item) => item.trim());
    if (!origin || !allowed.includes(origin)) { error(reply, 403, "Origin tidak diizinkan.", "FORBIDDEN"); return; }
  }
  const authorization = request.headers.authorization;
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : process.env.SESSION_MODE === "cookie" ? rawCookie(request) : null;
  if (!token) return;
  const result = await pool.query<{ user_id: string }>("SELECT user_id FROM sessions WHERE token_hash=$1 AND expires_at>now()", [sha(token)]);
  if (!result.rowCount) return;
  const user = await pool.query<UserRow>("SELECT id,name,email,role,status,status_reason,password_salt,password_hash,email_verified,created_at FROM users WHERE id=$1", [result.rows[0].user_id]);
  if (user.rows[0]) {
    request.authUser = safeUser(user.rows[0]);
    request.sessionToken = token;
  }
});
app.setErrorHandler((cause, _request, reply) => {
  requestLog(cause);
  if ((cause as { statusCode?: number }).statusCode === 413) return error(reply, 413, "Foto lebih dari 5 MB.", "IMAGE_TOO_LARGE");
  return error(reply, 500, "Terjadi kendala di server. Coba lagi sebentar.", "INTERNAL_ERROR");
});
function requestLog(cause: unknown) { app.log.error(cause); }

app.get("/api/health", async () => ({ ok: true, version: process.env.npm_package_version ?? "1.0.0", time: new Date().toISOString(), ...(GEOfENCE ? { checkInRadiusMeters: RADIUS } : {}) }));

app.post("/api/auth/register", async (request, reply) => {
  if (!(await consumeRateLimit(`register:${request.ip}`, 10, 3600))) return error(reply, 429, "Terlalu banyak percobaan pendaftaran. Coba lagi nanti.", "RATE_LIMITED");
  const parsed = schemas.register.safeParse(request.body);
  if (!parsed.success) return bad(reply, "Nama, email, atau kata sandi belum sesuai.");
  const { name, email, password, role } = parsed.data;
  const salt = crypto.randomBytes(16).toString("hex");
  const userId = id("usr");
  try {
    const result = await pool.query<UserRow>("INSERT INTO users(id,email,name,role,status,password_salt,password_hash) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,name,email,role,status,status_reason,password_salt,password_hash,email_verified,created_at", [userId, email.toLowerCase(), name, role, role === "MERCHANT" ? "PENDING" : null, salt, hashPassword(password, salt)]);
    await pool.query("INSERT INTO profiles(user_id) VALUES($1)", [userId]);
    const token = crypto.randomBytes(32).toString("base64url");
    await pool.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '30 days')", [sha(token), userId]);
    if (process.env.SESSION_MODE === "cookie") reply.header("Set-Cookie", `lokawira.session=${token}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=${SESSION_DAYS * 86400}`);
    return reply.code(201).send({ ...(process.env.SESSION_MODE === "cookie" ? {} : { token }), user: safeUser(result.rows[0]) });
  } catch (cause) {
    if ((cause as { code?: string }).code === "23505") return error(reply, 409, "Email sudah terdaftar.", "EMAIL_TAKEN");
    throw cause;
  }
});

app.post("/api/auth/login", async (request, reply) => {
  const parsed = schemas.login.safeParse(request.body);
  if (!parsed.success) return bad(reply, "Email dan kata sandi wajib diisi dengan benar.");
  const email = parsed.data.email.toLowerCase();
  const key = `login:${email}`;
  const limit = await pool.query<{ count: number; reset_at: Date }>("SELECT count,reset_at FROM rate_limits WHERE key=$1", [key]);
  if (limit.rows[0]?.count >= 5 && limit.rows[0].reset_at > new Date()) return error(reply, 429, "Terlalu banyak percobaan. Coba lagi sebentar lagi.", "RATE_LIMITED");
  const result = await pool.query<UserRow>("SELECT id,name,email,role,status,status_reason,password_salt,password_hash,email_verified,created_at FROM users WHERE email=$1", [email]);
  const user = result.rows[0];
  const valid = user && crypto.timingSafeEqual(Buffer.from(hashPassword(parsed.data.password, user.password_salt), "hex"), Buffer.from(user.password_hash, "hex"));
  if (!valid) {
    await pool.query("INSERT INTO rate_limits(key,count,reset_at) VALUES($1,1,now()+interval '60 seconds') ON CONFLICT(key) DO UPDATE SET count=CASE WHEN rate_limits.reset_at<now() THEN 1 ELSE rate_limits.count+1 END,reset_at=CASE WHEN rate_limits.reset_at<now() THEN now()+interval '60 seconds' ELSE rate_limits.reset_at END", [key]);
    return error(reply, 401, "Email atau kata sandi salah.", "BAD_CREDENTIALS");
  }
  await pool.query("DELETE FROM rate_limits WHERE key=$1", [key]);
  const token = crypto.randomBytes(32).toString("base64url");
  await pool.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '30 days')", [sha(token), user.id]);
  if (process.env.SESSION_MODE === "cookie") reply.header("Set-Cookie", `lokawira.session=${token}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=${SESSION_DAYS * 86400}`);
  return { ...(process.env.SESSION_MODE === "cookie" ? {} : { token }), user: safeUser(user) };
});

app.get("/api/auth/me", async (request, reply) => {
  const user = requestUser(request);
  return user ? { user } : error(reply, 401, "Sesi tidak ditemukan atau sudah berakhir.", "UNAUTHENTICATED");
});
app.post("/api/auth/logout", async (request, reply) => {
  const user = requestUser(request);
  const token = currentSession(request);
  if (!user || !token) return error(reply, 401, "Silakan masuk terlebih dahulu.", "UNAUTHENTICATED");
  await pool.query("DELETE FROM sessions WHERE token_hash=$1", [sha(token)]);
  if (process.env.SESSION_MODE === "cookie") reply.header("Set-Cookie", "lokawira.session=; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0");
  return { ok: true };
});

app.get("/api/spots", async (request) => {
  const user = requestUser(request);
  const query = request.query as { vibe?: string; limit?: string; cursor?: string };
  const all = (await visibleSpots(user)).filter((row) => !query.vibe || row.payload.vibe === query.vibe);
  const limit = Math.max(1, Math.min(100, Number(query.limit) || 100));
  const offset = query.cursor ? Number(Buffer.from(query.cursor, "base64url").toString()) || 0 : 0;
  const selected = all.slice(offset, offset + limit);
  const spots = selected.map((row) => row.payload);
  const vouchers = user?.role === "ADMIN" || user?.role === "MERCHANT" || user?.role === "VISITOR" ? await ownedRecords("voucher", user) as IssuedVoucher[] : [];
  const reservations = user?.role === "VISITOR" || user?.role === "ADMIN" ? await ownedRecords("reservation", user) as ReservationPass[] : [];
  const aiTrainingNotes = user?.role === "ADMIN" ? (await listEntities<Record<string, unknown>>("ai-note")).map((row) => row.payload) : [];
  return { spots, vouchers, reservations, aiTrainingNotes, ...(offset + selected.length < all.length ? { nextCursor: Buffer.from(String(offset + selected.length)).toString("base64url") } : {}) };
});

app.post("/api/spots", async (request, reply) => {
  const user = requireRoles(request, reply, ["MERCHANT", "ADMIN"]); if (!user) return;
  const input = request.body as CulturalSpot;
  const lat = Number(input?.coordinates?.lat); const lng = Number(input?.coordinates?.lng);
  if (!input || !String(input.name ?? "").trim() || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return bad(reply, "Nama dan lokasi pin wajib diisi dengan koordinat yang valid.");
  const discount = Number(input.quest?.voucherReward?.discountAmount); const minimum = Number(input.quest?.voucherReward?.minimumSpend);
  if (!Number.isFinite(discount) || discount < 1000 || discount > 100000 || !Number.isFinite(minimum) || minimum < 0 || minimum > 10000000) return bad(reply, "Nominal voucer atau minimal belanja belum sesuai.");
  if (!String(input.quest?.targetObjectPrompt ?? "").trim()) return bad(reply, "Tulis objek yang harus dipindai wisatawan.");
  if (user.role === "MERCHANT" && input.spotType === "PRIMARY_DEST") return error(reply, 403, "Hanya pengelola yang boleh menambah cagar budaya utama.", "FORBIDDEN");
  const spot: CulturalSpot = { ...input, id: id("spot"), ownerId: user.role === "MERCHANT" ? user.id : undefined, createdAt: new Date().toISOString(), status: user.role === "MERCHANT" ? "PENDING_REVIEW" : "PUBLISHED", coordinates: { lat, lng }, quest: { ...input.quest, referenceImages: [] } };
  await saveEntity("spot", spot.id, spot, spot.ownerId ?? null);
  return reply.code(201).send({ spot, spots: await visibleSpots(user).then((rows) => rows.map((row) => row.payload)) });
});

app.patch<{ Params: { id: string } }>("/api/spots/:id/quota", async (request, reply) => {
  const user = requireRoles(request, reply, ["ADMIN"]); if (!user) return;
  const row = await getSpot(request.params.id); if (!row) return error(reply, 404, "Titik lokasi tidak ditemukan.");
  const current = Number((request.body as { currentVisitors?: unknown })?.currentVisitors);
  if (!Number.isFinite(current)) return bad(reply, "Jumlah pengunjung tidak valid.");
  const spot = row.payload; spot.quota.currentVisitors = Math.max(0, Math.min(spot.quota.maxCapacity, current)); spot.quota.estimatedWaitMinutes = estimatedWait(spot.quota.currentVisitors, spot.quota.maxCapacity);
  await saveEntity("spot", spot.id, spot, row.owner_id);
  return { spot, spots: await visibleSpots(user).then((rows) => rows.map((item) => item.payload)) };
});

app.put<{ Params: { id: string } }>("/api/spots/:id/promo", async (request, reply) => {
  const user = requireRoles(request, reply, ["MERCHANT", "ADMIN"]); if (!user) return;
  const row = await getSpot(request.params.id); if (!row || row.payload.status === "ARCHIVED") return error(reply, 404, "Titik lokasi tidak ditemukan.");
  if (!(await isOwner(user, row))) return error(reply, 403, "Ini bukan lapak Anda.", "NOT_YOUR_SPOT");
  const body = request.body as { discountTitle?: string; discountAmount?: number; minimumSpend?: number; rewardPoints?: number };
  if (!String(body.discountTitle ?? "").trim() || !Number.isInteger(body.discountAmount) || Number(body.discountAmount) < 1000 || Number(body.discountAmount) > 100000 || !Number.isFinite(Number(body.minimumSpend)) || Number(body.minimumSpend) < 0 || Number(body.minimumSpend) > 10000000) return bad(reply, "Data promo belum valid.");
  row.payload.quest.voucherReward.discountTitle = body.discountTitle!.trim(); row.payload.quest.voucherReward.discountAmount = Number(body.discountAmount); row.payload.quest.voucherReward.minimumSpend = Number(body.minimumSpend);
  if (user.role === "ADMIN" && body.rewardPoints !== undefined) {
    if (!Number.isInteger(body.rewardPoints) || body.rewardPoints < 0 || body.rewardPoints > 1000) return bad(reply, "Poin hadiah harus 0 sampai 1.000.");
    row.payload.quest.rewardPoints = body.rewardPoints;
  }
  await saveEntity("spot", row.id, row.payload, row.owner_id);
  return { spot: row.payload, spots: await visibleSpots(user).then((items) => items.map((item) => item.payload)) };
});

app.patch<{ Params: { id: string } }>("/api/spots/:id", async (request, reply) => {
  const user = requireRoles(request, reply, ["MERCHANT", "ADMIN"]); if (!user) return;
  const row = await getSpot(request.params.id); if (!row || row.payload.status === "ARCHIVED") return error(reply, 404, "Titik lokasi tidak ditemukan.");
  if (!(await isOwner(user, row))) return error(reply, 403, "Ini bukan lapak Anda.", "NOT_YOUR_SPOT");
  const input = request.body && typeof request.body === "object" ? request.body as Record<string, unknown> : {};
  const allowedFields = new Set(["name", "address", "facilities", "coordinates", "quota", "quest", ...(user.role === "ADMIN" ? ["spotType", "opkCategory", "vibe", "regionName"] : [])]);
  const body = Object.fromEntries(Object.entries(input).filter(([field]) => allowedFields.has(field)));
  if (body.quest && typeof body.quest === "object" && !Array.isArray(body.quest)) {
    const quest = body.quest as Record<string, unknown>;
    const questFields = new Set(["riddleTitle", "riddleClue", "loreNarrative", "targetObjectPrompt", ...(user.role === "ADMIN" ? ["verifiedLoreSource", "rewardPoints"] : [])]);
    body.quest = Object.fromEntries(Object.entries(quest).filter(([field]) => questFields.has(field)));
  }
  if (body.quota && typeof body.quota === "object" && !Array.isArray(body.quota)) {
    const quota = body.quota as Record<string, unknown>;
    body.quota = Object.fromEntries(Object.entries(quota).filter(([field]) => field === "maxCapacity"));
  }
  const spot = row.payload; const oldName = spot.name; const oldCoordinates = { ...spot.coordinates };
  if (body.name !== undefined && String(body.name).trim().length < 3) return bad(reply, "Nama minimal 3 karakter.");
  if (body.address !== undefined && String(body.address).trim().length < 5) return bad(reply, "Alamat terlalu pendek.");
  if (body.coordinates && typeof body.coordinates === "object") {
    const coordinates = body.coordinates as { lat?: unknown; lng?: unknown };
    if (!Number.isFinite(Number(coordinates.lat)) || !Number.isFinite(Number(coordinates.lng)) || Math.abs(Number(coordinates.lat)) > 90 || Math.abs(Number(coordinates.lng)) > 180) return bad(reply, "Koordinat tidak valid.");
  }
  if (body.facilities !== undefined && (!Array.isArray(body.facilities) || body.facilities.length > 12 || body.facilities.some((item) => typeof item !== "string"))) return bad(reply, "Daftar fasilitas tidak valid.");
  if (body.quota && typeof body.quota === "object") {
    const capacity = Number((body.quota as { maxCapacity?: unknown }).maxCapacity);
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 500) return bad(reply, "Kapasitas harus 1 sampai 500 orang.");
  }
  if (body.quest && typeof body.quest === "object") {
    const quest = body.quest as Record<string, unknown>;
    if (quest.targetObjectPrompt !== undefined && !String(quest.targetObjectPrompt).trim()) return bad(reply, "Tulis objek yang harus dipindai wisatawan.");
    if (quest.rewardPoints !== undefined && (!Number.isInteger(Number(quest.rewardPoints)) || Number(quest.rewardPoints) < 0 || Number(quest.rewardPoints) > 1000)) return bad(reply, "Poin hadiah harus 0 sampai 1.000.");
    if (quest.rewardPoints !== undefined) quest.rewardPoints = Number(quest.rewardPoints);
  }
  deepMerge(spot as unknown as Record<string, unknown>, body);
  if (body.facilities) spot.facilities = (body.facilities as string[]).slice(0, 12);
  if (body.quota) spot.quota.currentVisitors = Math.min(spot.quota.currentVisitors, spot.quota.maxCapacity);
  if (spot.name !== oldName) spot.quest.voucherReward.merchantName = spot.name;
  const moved = spot.coordinates.lat !== oldCoordinates.lat || spot.coordinates.lng !== oldCoordinates.lng;
  if (user.role === "MERCHANT" && (spot.name !== oldName || moved)) spot.status = "PENDING_REVIEW";
  await saveEntity("spot", row.id, spot, row.owner_id);
  return { spot, spots: await visibleSpots(user).then((items) => items.map((item) => item.payload)) };
});
app.delete<{ Params: { id: string } }>("/api/spots/:id", async (request, reply) => {
  const user = requireRoles(request, reply, ["MERCHANT", "ADMIN"]); if (!user) return;
  const row = await getSpot(request.params.id); if (!row || row.payload.status === "ARCHIVED") return error(reply, 404, "Titik lokasi tidak ditemukan.");
  if (!(await isOwner(user, row))) return error(reply, 403, "Ini bukan lapak Anda.", "NOT_YOUR_SPOT");
  if (row.payload.spotType === "PRIMARY_DEST" && user.role !== "ADMIN") return error(reply, 403, "Cagar budaya utama hanya bisa diarsipkan pengelola.", "FORBIDDEN");
  row.payload.status = "ARCHIVED"; await saveEntity("spot", row.id, row.payload, row.owner_id);
  return { spots: await visibleSpots(user).then((items) => items.map((item) => item.payload)) };
});

app.post("/api/reservations", async (request, reply) => {
  if (!(await consumeRateLimit(`reservation:${request.ip}`, 20, 3600))) return error(reply, 429, "Terlalu banyak permintaan reservasi. Coba lagi nanti.", "RATE_LIMITED");
  const parsed = schemas.reservation.safeParse(request.body); if (!parsed.success) return bad(reply, "Nama, titik, atau jumlah pengunjung belum valid.");
  const body = parsed.data; const user = requestUser(request); const row = await getSpot(body.spotId); if (!row || !(await spotVisibleTo(user, body.spotId))) return error(reply, 404, "Titik lokasi tidak ditemukan.");
  const spot = row.payload; const ticketId = await uniqueCode("reservation", `PASS-${spot.vibe.slice(0, 3).toUpperCase()}`, "ticketId");
  const reservation: ReservationPass = { ticketId, spotId: spot.id, spotName: spot.name, visitorName: body.visitorName, partySize: body.partySize, scheduledSlot: body.scheduledSlot || spot.quota.nextAvailableSlot, status: "CONFIRMED", circularQuestAccepted: body.acceptCircularQuest, createdAt: new Date().toISOString() };
  await saveEntity("reservation", ticketId, reservation, user?.id ?? null);
  await addXp(user?.id ?? null, 75);
  let bonusVoucher: IssuedVoucher | undefined;
  if (body.acceptCircularQuest) {
    const partners = (await listEntities<CulturalSpot>("spot")).filter((candidate) => candidate.owner_id && candidate.payload.vibe === spot.vibe && candidate.payload.spotType !== "PRIMARY_DEST" && (candidate.payload.status ?? "PUBLISHED") === "PUBLISHED");
    const ownerStatuses = await pool.query<{ id: string; status: string | null }>("SELECT id,status FROM users WHERE role='MERCHANT'");
    const active = new Set(ownerStatuses.rows.filter((owner) => owner.status === "ACTIVE").map((owner) => owner.id));
    const partner = partners.filter((candidate) => !!candidate.owner_id && active.has(candidate.owner_id)).sort((a, b) => distanceMeters(a.payload.coordinates, spot.coordinates) - distanceMeters(b.payload.coordinates, spot.coordinates))[0];
    if (partner) {
      const code = await uniqueCode("voucher", "LKW", "code");
      const reward = partner.payload.quest.voucherReward;
      bonusVoucher = { code, signatureHash: crypto.createHmac("sha256", process.env.SESSION_SECRET ?? "replace-this-secret").update(`${code}:${partner.id}`).digest("hex"), spotId: partner.id, merchantName: reward.merchantName, discountTitle: `Voucer Pengalih Antrean: ${reward.discountTitle}`, discountAmount: reward.discountAmount, minimumSpend: reward.minimumSpend, expiresAt: null, status: "ACTIVE" };
      await saveEntity("voucher", code, bonusVoucher, user?.id ?? null);
    }
  }
  return { reservation, ...(bonusVoucher ? { bonusVoucher } : {}), reservations: user?.role === "VISITOR" ? await ownedRecords("reservation", user) as ReservationPass[] : [reservation], vouchers: user?.role === "VISITOR" ? await ownedRecords("voucher", user) as IssuedVoucher[] : bonusVoucher ? [bonusVoucher] : [] };
});

app.post("/api/reservations/checkin", async (request, reply) => {
  const user = requireRoles(request, reply, ["ADMIN"]); if (!user) return;
  const ticketId = String((request.body as { ticketId?: string })?.ticketId ?? "").trim(); if (!ticketId) return bad(reply, "Nomor tiket wajib diisi.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<EntityRow<ReservationPass>>("SELECT id,kind,owner_id,payload FROM entities WHERE kind='reservation' AND id=$1 FOR UPDATE", [ticketId]);
    const row = result.rows[0]; if (!row) { await client.query("ROLLBACK"); return error(reply, 404, "E-Ticket tidak ditemukan."); }
    if (row.payload.status === "CHECKED_IN") { await client.query("ROLLBACK"); return error(reply, 409, "E-Ticket sudah dipakai masuk.", "TICKET_ALREADY_USED"); }
    row.payload.status = "CHECKED_IN"; await client.query("UPDATE entities SET payload=$1 WHERE kind='reservation' AND id=$2", [JSON.stringify(row.payload), row.id]);
    await client.query("COMMIT");
    return { reservation: row.payload, reservations: (await listEntities<ReservationPass>("reservation")).map((item) => item.payload) };
  } catch (cause) { await client.query("ROLLBACK"); throw cause; } finally { client.release(); }
});

app.post("/api/checkins", async (request, reply) => {
  const body = request.body as { spotId?: string; lat?: number; lng?: number; accuracyMeters?: number };
  const user = requestUser(request); const row = body?.spotId ? await getSpot(body.spotId) : null; if (!row || !(await spotVisibleTo(user, body.spotId ?? ""))) return error(reply, 404, "Titik lokasi tidak ditemukan.");
  const spot = row.payload; if (geofence(reply, body, spot, "check-in")) return;
  const today = new Date().toISOString().slice(0, 10);
  const visitorKey = user?.id ?? `guest:${sha(request.ip)}`;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`checkin:${visitorKey}:${spot.id}:${today}`]);
    const recent = await client.query<{ payload: { createdAt: string; spotId: string } }>("SELECT payload FROM entities WHERE kind='checkin' AND owner_id=$1 ORDER BY created_at DESC", [visitorKey]);
    if (recent.rows.some((item) => item.payload.spotId === spot.id && item.payload.createdAt.slice(0, 10) === today)) { await client.query("ROLLBACK"); return error(reply, 409, "Kamu sudah check-in di titik ini hari ini.", "ALREADY_CHECKED_IN_TODAY"); }
    const last = recent.rows[0];
    if (last && Date.now() - Date.parse(last.payload.createdAt) < 600_000) {
      const previousSpot = await getSpot(last.payload.spotId);
      if (previousSpot && distanceMeters(previousSpot.payload.coordinates, spot.coordinates) / Math.max((Date.now() - Date.parse(last.payload.createdAt)) / 1000, 1) > 40) { await client.query("ROLLBACK"); return error(reply, 403, "Perpindahan terlalu cepat dari check-in sebelumnya.", "IMPOSSIBLE_TRAVEL"); }
    }
    const code = await uniqueCode("checkin", "KDR", "code"); const checkinId = id("ci"); const createdAt = new Date().toISOString();
    await client.query("INSERT INTO entities(id,kind,owner_id,payload) VALUES($1,'checkin',$2,$3)", [checkinId, visitorKey, JSON.stringify({ id: checkinId, code, spotId: spot.id, createdAt, verified: false })]);
    if (user) await client.query("UPDATE profiles SET xp=xp+50 WHERE user_id=$1", [user.id]);
    await client.query("COMMIT");
    return { checkIn: { id: checkinId, code, spotId: spot.id, createdAt }, awardedPoints: 50 };
  } catch (cause) { await client.query("ROLLBACK"); throw cause; } finally { client.release(); }
});

app.post("/api/checkins/verify", async (request, reply) => {
  const user = requireRoles(request, reply, ["MERCHANT", "ADMIN"]); if (!user) return;
  const parsed = schemas.code.safeParse(request.body); if (!parsed.success) return bad(reply, "Kode kehadiran wajib diisi.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<EntityRow<{ id: string; code: string; spotId: string; createdAt: string; verified: boolean; verifiedAt?: string }>>("SELECT id,kind,owner_id,payload FROM entities WHERE kind='checkin' AND upper(payload->>'code')=upper($1) FOR UPDATE", [parsed.data.code]);
    const record = result.rows[0]; if (!record) { await client.query("ROLLBACK"); return error(reply, 404, "Kode kehadiran tidak ditemukan.", "CHECKIN_NOT_FOUND"); }
    if (record.payload.verified) { await client.query("ROLLBACK"); return error(reply, 409, "Kode kehadiran sudah diverifikasi.", "CHECKIN_ALREADY_VERIFIED"); }
    const spot = await getSpot(record.payload.spotId); if (!spot) { await client.query("ROLLBACK"); return error(reply, 404, "Titik lokasi tidak ditemukan."); }
    if (!(await isOwner(user, spot))) { await client.query("ROLLBACK"); return error(reply, 403, "Kode ini milik lapak lain.", "NOT_YOUR_SPOT"); }
    record.payload.verified = true; record.payload.verifiedAt = new Date().toISOString();
    await client.query("UPDATE entities SET payload=$1 WHERE kind='checkin' AND id=$2", [JSON.stringify(record.payload), record.id]);
    const reward = spot.payload.quest.rewardPoints;
    if (record.owner_id && !record.owner_id.startsWith("guest:")) await client.query("INSERT INTO profiles(user_id,xp) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET xp=profiles.xp+EXCLUDED.xp", [record.owner_id, reward]);
    await client.query("COMMIT");
    return { verified: true, spotId: spot.id, spotName: spot.payload.name, awardedPoints: reward };
  } catch (cause) { await client.query("ROLLBACK"); throw cause; } finally { client.release(); }
});

app.post("/api/vouchers/redeem", async (request, reply) => {
  const user = requireRoles(request, reply, ["MERCHANT", "ADMIN"]); if (!user) return;
  if (!(await consumeRateLimit(`redeem:${user.id}`, 60, 3600))) return error(reply, 429, "Terlalu banyak penebusan. Coba lagi nanti.", "RATE_LIMITED");
  const parsed = schemas.code.safeParse(request.body); if (!parsed.success) return bad(reply, "Masukkan kode voucer.");
  const raw = parsed.data.code.toUpperCase(); const code = raw.startsWith("LKW-") ? raw : `LKW-${raw}`;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<EntityRow<IssuedVoucher>>("SELECT id,kind,owner_id,payload FROM entities WHERE kind='voucher' AND upper(payload->>'code')=upper($1) FOR UPDATE", [code]);
    const row = result.rows[0];
    if (!row) { await client.query("ROLLBACK"); return error(reply, 404, "Kode voucer tidak ditemukan."); }
    const spotOwner = await client.query<{ owner_id: string | null }>("SELECT owner_id FROM entities WHERE kind='spot' AND id=$1", [row.payload.spotId]);
    if (user.role !== "ADMIN" && spotOwner.rows[0]?.owner_id !== user.id) { await client.query("ROLLBACK"); return error(reply, 403, "Voucer ini berlaku di lapak lain, bukan lapak Anda.", "NOT_YOUR_VOUCHER"); }
    if (row.payload.status === "REDEEMED") { await client.query("ROLLBACK"); return error(reply, 409, "Voucer ini sudah pernah ditebus.", "VOUCHER_ALREADY_REDEEMED"); }
    row.payload.status = "REDEEMED"; row.payload.redeemedAt = new Date().toISOString();
    await client.query("UPDATE entities SET payload=$1 WHERE id=$2 AND kind='voucher'", [JSON.stringify(row.payload), row.id]);
    await client.query("INSERT INTO redemption_audit(voucher_code,merchant_user_id) VALUES($1,$2)", [row.payload.code, user.id]);
    await client.query("COMMIT");
    const vouchers = user.role === "ADMIN" ? (await listEntities<IssuedVoucher>("voucher")).map((item) => item.payload) : await ownedRecords("voucher", user) as IssuedVoucher[];
    return { redeemedVoucher: row.payload, vouchers };
  } catch (cause) { await client.query("ROLLBACK"); throw cause; } finally { client.release(); }
});

app.post("/api/ai-notes", async (request, reply) => {
  const user = requireRoles(request, reply, ["ADMIN"]); if (!user) return;
  const body = request.body as { opkCategory?: string; maestroSource?: string; summary?: string };
  if (!body.opkCategory || !body.maestroSource || !body.summary) return bad(reply, "Kategori, sumber maestro, dan ringkasan wajib diisi.");
  const note = { id: id("note"), opkCategory: body.opkCategory, maestroSource: body.maestroSource, summary: body.summary, updatedAt: new Date().toISOString() };
  await saveEntity("ai-note", note.id, note); return reply.code(201).send({ aiTrainingNotes: (await listEntities("ai-note")).map((row) => row.payload) });
});
app.patch<{ Params: { id: string } }>("/api/ai-notes/:id", async (request, reply) => {
  const user = requireRoles(request, reply, ["ADMIN"]); if (!user) return;
  const row = await getEntity<Record<string, unknown>>("ai-note", request.params.id); if (!row) return error(reply, 404, "Catatan pengetahuan tidak ditemukan.");
  const patch = request.body as { maestroSource?: string; summary?: string };
  if (patch.maestroSource !== undefined && patch.maestroSource.trim().length < 5) return bad(reply, "Sumber maestro minimal 5 karakter.");
  if (patch.summary !== undefined && patch.summary.trim().length < 20) return bad(reply, "Ringkasan minimal 20 karakter.");
  Object.assign(row.payload, patch, { updatedAt: new Date().toISOString() }); await saveEntity("ai-note", row.id, row.payload);
  return { aiTrainingNotes: (await listEntities("ai-note")).map((item) => item.payload) };
});
app.delete<{ Params: { id: string } }>("/api/ai-notes/:id", async (request, reply) => {
  const user = requireRoles(request, reply, ["ADMIN"]); if (!user) return;
  const result = await pool.query("DELETE FROM entities WHERE kind='ai-note' AND id=$1", [request.params.id]); if (!result.rowCount) return error(reply, 404, "Catatan pengetahuan tidak ditemukan.");
  return { aiTrainingNotes: (await listEntities("ai-note")).map((item) => item.payload) };
});

app.get("/api/me/profile", async (request, reply) => {
  const user = requestUser(request); if (!user) return error(reply, 401, "Silakan masuk terlebih dahulu.", "UNAUTHENTICATED");
  const prof = await profile(user.id);
  const checkins = await pool.query<{ payload: { spotId: string } }>("SELECT payload FROM entities WHERE kind='checkin' AND owner_id=$1", [user.id]);
  return { xp: prof.xp, level: Math.floor(prof.xp / 150) + 1, checkedInSpotIds: [...new Set(checkins.rows.map((row) => row.payload.spotId))], loreCards: prof.lore_cards, vouchers: await ownedRecords("voucher", user), reservations: await ownedRecords("reservation", user) };
});

app.post<{ Params: { id: string } }>("/api/admin/merchants/:id/approve", async (request, reply) => {
  const user = requireRoles(request, reply, ["ADMIN"]); if (!user) return;
  const result = await pool.query<UserRow>("UPDATE users SET status='ACTIVE',status_reason=NULL WHERE id=$1 AND role='MERCHANT' AND status IS DISTINCT FROM 'ACTIVE' RETURNING id,name,email,role,status,status_reason,created_at", [request.params.id]);
  if (!result.rowCount) {
    const existing = await pool.query("SELECT 1 FROM users WHERE id=$1 AND role='MERCHANT'", [request.params.id]);
    return existing.rowCount ? error(reply, 409, "Mitra ini sudah aktif.", "ALREADY_DECIDED") : error(reply, 404, "Mitra tidak ditemukan.");
  }
  return { merchant: await merchantSummary(result.rows[0]) };
});
app.post<{ Params: { id: string } }>("/api/admin/merchants/:id/reject", async (request, reply) => {
  const user = requireRoles(request, reply, ["ADMIN"]); if (!user) return;
  const reason = String((request.body as { reason?: string })?.reason ?? "").trim().slice(0, 200);
  const result = await pool.query<UserRow>("UPDATE users SET status='REJECTED',status_reason=$2 WHERE id=$1 AND role='MERCHANT' AND status IS DISTINCT FROM 'REJECTED' RETURNING id,name,email,role,status,status_reason,created_at", [request.params.id, reason || null]);
  if (!result.rowCount) {
    const existing = await pool.query("SELECT 1 FROM users WHERE id=$1 AND role='MERCHANT'", [request.params.id]);
    return existing.rowCount ? error(reply, 409, "Keputusan untuk mitra ini sudah dibuat.", "ALREADY_DECIDED") : error(reply, 404, "Mitra tidak ditemukan.");
  }
  return { merchant: await merchantSummary(result.rows[0]) };
});
async function merchantSummary(user: UserRow) {
  const count = await pool.query<{ count: string }>("SELECT count(*) FROM entities WHERE kind='spot' AND owner_id=$1 AND payload->>'status' IS DISTINCT FROM 'ARCHIVED'", [user.id]);
  return { id: user.id, name: user.name, email: user.email, status: user.status ?? "ACTIVE", statusReason: user.status_reason ?? undefined, createdAt: user.created_at, spotCount: Number(count.rows[0].count) };
}
app.get("/api/admin/merchants", async (request, reply) => {
  const user = requireRoles(request, reply, ["ADMIN"]); if (!user) return;
  const query = request.query as { status?: string; limit?: string; cursor?: string };
  const result = await pool.query<UserRow>("SELECT id,name,email,role,status,status_reason,password_salt,password_hash,email_verified,created_at FROM users WHERE role='MERCHANT' AND ($1::text IS NULL OR status=$1) ORDER BY created_at DESC", [query.status || null]);
  const limit = Math.max(1, Math.min(100, Number(query.limit) || 20)); const offset = query.cursor ? Number(Buffer.from(query.cursor, "base64url").toString()) || 0 : 0; const merchants = await Promise.all(result.rows.slice(offset, offset + limit).map(merchantSummary));
  return { merchants, ...(offset + merchants.length < result.rowCount! ? { nextCursor: Buffer.from(String(offset + merchants.length)).toString("base64url") } : {}) };
});
app.post<{ Params: { id: string } }>("/api/admin/spots/:id/review", async (request, reply) => {
  const user = requireRoles(request, reply, ["ADMIN"]); if (!user) return;
  const row = await getSpot(request.params.id); if (!row || row.payload.status === "ARCHIVED") return error(reply, 404, "Titik lokasi tidak ditemukan.");
  if (row.payload.status && row.payload.status !== "PENDING_REVIEW") return error(reply, 409, "Titik ini sudah pernah diputuskan.", "ALREADY_REVIEWED");
  const body = request.body as { decision?: string; reason?: string }; if (body.decision !== "PUBLISH" && body.decision !== "REJECT") return bad(reply, "Keputusan tidak valid.");
  row.payload.status = body.decision === "PUBLISH" ? "PUBLISHED" : "REJECTED"; row.payload.statusReason = body.decision === "REJECT" ? String(body.reason ?? "").trim().slice(0, 200) || undefined : undefined;
  await saveEntity("spot", row.id, row.payload, row.owner_id);
  return { spot: row.payload, spots: await visibleSpots(user).then((items) => items.map((item) => item.payload)) };
});
app.get("/api/admin/reservations", async (request, reply) => {
  const user = requireRoles(request, reply, ["ADMIN"]); if (!user) return;
  const query = request.query as { spotId?: string; status?: string; from?: string; to?: string };
  const result = await paginated<ReservationPass>("reservation", request, (row) => (!query.spotId || row.payload.spotId === query.spotId) && (!query.status || row.payload.status === query.status) && (!query.from || row.payload.createdAt >= query.from) && (!query.to || row.payload.createdAt <= query.to));
  return { reservations: result.rows.map((row) => row.payload), ...(result.nextCursor ? { nextCursor: result.nextCursor } : {}) };
});
app.get("/api/admin/vouchers", async (request, reply) => {
  const user = requireRoles(request, reply, ["ADMIN"]); if (!user) return;
  const query = request.query as { spotId?: string; status?: string };
  const result = await paginated<IssuedVoucher>("voucher", request, (row) => (!query.spotId || row.payload.spotId === query.spotId) && (!query.status || row.payload.status === query.status));
  return { vouchers: result.rows.map((row) => row.payload), ...(result.nextCursor ? { nextCursor: result.nextCursor } : {}) };
});

app.post("/api/auth/change-password", async (request, reply) => {
  const user = requestUser(request); if (!user) return error(reply, 401, "Silakan masuk terlebih dahulu.", "UNAUTHENTICATED");
  const body = request.body as { currentPassword?: string; newPassword?: string }; if (!body.currentPassword || !schemas.password.safeParse(body.newPassword).success) return bad(reply, "Kata sandi baru minimal 8 karakter.");
  const row = await pool.query<UserRow>("SELECT id,name,email,role,status,status_reason,password_salt,password_hash,email_verified,created_at FROM users WHERE id=$1", [user.id]);
  const current = row.rows[0]; if (!current || !crypto.timingSafeEqual(Buffer.from(hashPassword(body.currentPassword, current.password_salt), "hex"), Buffer.from(current.password_hash, "hex"))) return error(reply, 401, "Kata sandi saat ini salah.", "BAD_CREDENTIALS");
  const salt = crypto.randomBytes(16).toString("hex"); await pool.query("UPDATE users SET password_salt=$1,password_hash=$2 WHERE id=$3", [salt, hashPassword(body.newPassword!, salt), user.id]); await pool.query("DELETE FROM sessions WHERE user_id=$1", [user.id]);
  const token = crypto.randomBytes(32).toString("base64url"); await pool.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '30 days')", [sha(token), user.id]);
  if (process.env.SESSION_MODE === "cookie") { reply.header("Set-Cookie", `lokawira.session=${token}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=${SESSION_DAYS * 86400}`); return { ok: true }; }
  return { ok: true, token };
});
app.delete("/api/me", async (request, reply) => {
  const user = requestUser(request); if (!user) return error(reply, 401, "Silakan masuk terlebih dahulu.", "UNAUTHENTICATED");
  const password = (request.body as { password?: string })?.password; if (!password) return bad(reply, "Masukkan kata sandi untuk mengonfirmasi.");
  const row = await pool.query<UserRow>("SELECT id,name,email,role,status,status_reason,password_salt,password_hash,email_verified,created_at FROM users WHERE id=$1", [user.id]);
  if (!row.rows[0] || !crypto.timingSafeEqual(Buffer.from(hashPassword(password, row.rows[0].password_salt), "hex"), Buffer.from(row.rows[0].password_hash, "hex"))) return error(reply, 401, "Kata sandi salah.", "BAD_CREDENTIALS");
  await pool.query("UPDATE entities SET payload=jsonb_set(payload,'{status}','\"ARCHIVED\"'::jsonb) WHERE kind='spot' AND owner_id=$1", [user.id]);
  await pool.query("DELETE FROM entities WHERE kind='reference-image' AND owner_id IN (SELECT id FROM entities WHERE kind='spot' AND owner_id=$1)", [user.id]);
  await pool.query("UPDATE entities SET payload=jsonb_set(payload,'{quest,referenceImages}','[]'::jsonb) WHERE kind='spot' AND owner_id=$1", [user.id]);
  await pool.query("UPDATE entities SET owner_id=NULL,payload=jsonb_set(payload,'{visitorName}','\"Pengunjung\"'::jsonb) WHERE kind='reservation' AND owner_id=$1", [user.id]);
  await pool.query("UPDATE entities SET owner_id=NULL WHERE kind='voucher' AND owner_id=$1", [user.id]);
  await pool.query("UPDATE entities SET owner_id=NULL,payload=payload-'userId' WHERE kind='checkin' AND owner_id=$1", [user.id]);
  await pool.query("UPDATE entities SET owner_id=NULL,payload=jsonb_set(payload,'{ownerId}','null'::jsonb) WHERE kind='spot' AND owner_id=$1", [user.id]);
  await pool.query("DELETE FROM users WHERE id=$1", [user.id]);
  if (process.env.SESSION_MODE === "cookie") reply.header("Set-Cookie", "lokawira.session=; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0");
  return { ok: true };
});
app.post("/api/auth/forgot-password", async (request, reply) => {
  const email = String((request.body as { email?: string })?.email ?? "").trim().toLowerCase(); if (!email) return bad(reply, "Email wajib diisi.");
  if (!(await consumeRateLimit(`forgot:${request.ip}`, 5, 3600))) return error(reply, 429, "Terlalu banyak permintaan. Coba lagi nanti.", "RATE_LIMITED");
  const result = await pool.query<{ id: string }>("SELECT id FROM users WHERE email=$1", [email]);
  if (result.rows[0] && process.env.SMTP_HOST) {
    const token = crypto.randomBytes(32).toString("base64url"); await pool.query("INSERT INTO one_time_tokens(token_hash,user_id,purpose,expires_at) VALUES($1,$2,'RESET_PASSWORD',now()+interval '30 minutes')", [sha(token), result.rows[0].id]);
    try { await sendMail(email, "Atur ulang kata sandi LOKAWIRA", `Buka ${process.env.FRONTEND_URL ?? "http://localhost:3000"}/lupa-sandi?token=${encodeURIComponent(token)} untuk mengatur ulang kata sandi.`); }
    catch (cause) { app.log.error({ err: cause }, "Email reset sandi gagal dikirim"); }
  }
  return { ok: true };
});
app.post("/api/auth/reset-password", async (request, reply) => {
  const body = request.body as { token?: string; password?: string }; if (!body.token || !schemas.password.safeParse(body.password).success) return bad(reply, "Tautan atau kata sandi tidak valid.");
  const result = await pool.query<{ user_id: string }>("DELETE FROM one_time_tokens WHERE token_hash=$1 AND purpose='RESET_PASSWORD' AND expires_at>now() RETURNING user_id", [sha(body.token)]);
  if (!result.rows[0]) return error(reply, 400, "Tautan atur ulang tidak valid atau sudah kedaluwarsa.", "TOKEN_INVALID_OR_EXPIRED");
  const salt = crypto.randomBytes(16).toString("hex"); await pool.query("UPDATE users SET password_salt=$1,password_hash=$2 WHERE id=$3", [salt, hashPassword(body.password!, salt), result.rows[0].user_id]); await pool.query("DELETE FROM sessions WHERE user_id=$1", [result.rows[0].user_id]); return { ok: true };
});
app.post("/api/auth/verify-email", async (request, reply) => {
  const token = String((request.body as { token?: string })?.token ?? ""); const result = await pool.query<{ user_id: string }>("DELETE FROM one_time_tokens WHERE token_hash=$1 AND purpose='VERIFY_EMAIL' AND expires_at>now() RETURNING user_id", [sha(token)]);
  if (!result.rows[0]) return error(reply, 400, "Tautan verifikasi tidak valid atau sudah kedaluwarsa.", "TOKEN_INVALID_OR_EXPIRED");
  await pool.query("UPDATE users SET email_verified=true WHERE id=$1", [result.rows[0].user_id]); return { ok: true };
});
app.post("/api/auth/resend-verification", async (request, reply) => {
  const user = requestUser(request); if (!user) return error(reply, 401, "Silakan masuk terlebih dahulu.", "UNAUTHENTICATED");
  const result = await pool.query<{ email_verified: boolean }>("SELECT email_verified FROM users WHERE id=$1", [user.id]); if (result.rows[0]?.email_verified) return { ok: true };
  if (!(await consumeRateLimit(`verify:${user.id}`, 1, 60))) return error(reply, 429, "Terlalu banyak permintaan. Coba lagi nanti.", "RATE_LIMITED");
  const token = crypto.randomBytes(32).toString("base64url"); await pool.query("INSERT INTO one_time_tokens(token_hash,user_id,purpose,expires_at) VALUES($1,$2,'VERIFY_EMAIL',now()+interval '24 hours')", [sha(token), user.id]);
  try { await sendMail(user.email, "Verifikasi email LOKAWIRA", `Buka ${process.env.FRONTEND_URL ?? "http://localhost:3000"}/verifikasi-email?token=${encodeURIComponent(token)} untuk memverifikasi email.`); }
  catch (cause) { app.log.error({ err: cause }, "Email verifikasi gagal dikirim"); }
  return { ok: true };
});
async function sendMail(to: string, subject: string, text: string) {
  if (!process.env.SMTP_HOST) throw new Error("SMTP_HOST belum dikonfigurasi.");
  const transport = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT) || 587, secure: process.env.SMTP_SECURE === "true", auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined });
  await transport.sendMail({ from: process.env.SMTP_FROM ?? "LOKAWIRA <noreply@example.id>", to, subject, text });
}

app.post("/api/spots/:id/reference-images", async (request, reply) => {
  const user = requireRoles(request, reply, ["MERCHANT", "ADMIN"]); if (!user) return;
  const spotId = (request.params as { id: string }).id; const row = await getSpot(spotId); if (!row || row.payload.status === "ARCHIVED") return error(reply, 404, "Titik lokasi tidak ditemukan.");
  if (!(await isOwner(user, row))) return error(reply, 403, "Ini bukan lapak Anda.", "NOT_YOUR_SPOT");
  let part; try { part = await request.file(); } catch { return error(reply, 413, "Foto lebih dari 5 MB.", "IMAGE_TOO_LARGE"); }
  if (!part || part.fieldname !== "image") return bad(reply, "Kirim foto pada field image.");
  if (!imageTypes.has(part.mimetype)) return error(reply, 415, "Format foto harus JPEG, PNG, atau WebP.", "IMAGE_TYPE_UNSUPPORTED");
  const data = await part.toBuffer(); if (data.length > MAX_IMAGE_BYTES) return error(reply, 413, "Foto lebih dari 5 MB.", "IMAGE_TOO_LARGE");
  if (!imageSignatureMatches(part.mimetype, data)) return error(reply, 415, "Isi foto tidak sesuai dengan format berkasnya.", "IMAGE_TYPE_UNSUPPORTED");
  const images = row.payload.quest.referenceImages ?? []; if (images.length >= 5) return error(reply, 409, "Maksimal 5 foto contoh per lapak.", "TOO_MANY_IMAGES");
  const imageId = id("img"); images.push({ id: imageId, url: `/api/spots/${encodeURIComponent(spotId)}/reference-images/${encodeURIComponent(imageId)}` }); row.payload.quest.referenceImages = images;
  await pool.query("INSERT INTO entities(id,kind,owner_id,payload,file_data,mime_type) VALUES($1,'reference-image',$2,$3,$4,$5)", [imageId, spotId, JSON.stringify({ spotId }), data, part.mimetype]); await saveEntity("spot", row.id, row.payload, row.owner_id);
  return { referenceImages: images };
});
app.get<{ Params: { id: string; imageId: string } }>("/api/spots/:id/reference-images/:imageId", async (request, reply) => {
  const image = await pool.query<{ file_data: Buffer; mime_type: string }>("SELECT file_data,mime_type FROM entities WHERE kind='reference-image' AND id=$1 AND owner_id=$2", [request.params.imageId, request.params.id]);
  if (!image.rows[0]) return error(reply, 404, "Foto contoh tidak ditemukan.");
  return reply.type(image.rows[0].mime_type).header("Cache-Control", "public, max-age=86400").send(image.rows[0].file_data);
});
app.delete<{ Params: { id: string; imageId: string } }>("/api/spots/:id/reference-images/:imageId", async (request, reply) => {
  const user = requireRoles(request, reply, ["MERCHANT", "ADMIN"]); if (!user) return;
  const spot = await getSpot(request.params.id); if (!spot) return error(reply, 404, "Titik lokasi tidak ditemukan.");
  if (!(await isOwner(user, spot))) return error(reply, 403, "Ini bukan lapak Anda.", "NOT_YOUR_SPOT");
  const result = await pool.query("DELETE FROM entities WHERE kind='reference-image' AND id=$1 AND owner_id=$2", [request.params.imageId, request.params.id]);
  if (!result.rowCount) return error(reply, 404, "Foto contoh tidak ditemukan.");
  spot.payload.quest.referenceImages = (spot.payload.quest.referenceImages ?? []).filter((image) => image.id !== request.params.imageId); await saveEntity("spot", spot.id, spot.payload, spot.owner_id);
  return { referenceImages: spot.payload.quest.referenceImages };
});

app.post("/api/ai/storyteller", async (request, reply) => {
  const body = request.body as { spotId?: string; customQuestion?: string }; const user = requestUser(request); const row = body.spotId ? await getSpot(body.spotId) : null; if (!row || !(await spotVisibleTo(user, body.spotId ?? ""))) return error(reply, 404, "Titik lokasi tidak ditemukan.");
  const spot = row.payload; const result = await generateCulturalStoryAndValidation({ spotName: spot.name, opkCategory: spot.opkCategory, verifiedLoreSource: spot.quest.verifiedLoreSource, riddleClue: spot.quest.riddleClue, loreNarrative: body.customQuestion ? `Menjawab pertanyaan Anda tentang "${body.customQuestion}" di ${spot.name}: Berdasarkan rujukan ${spot.quest.verifiedLoreSource}, ${spot.quest.loreNarrative}` : spot.quest.loreNarrative, userQueryOrImageBase64: body.customQuestion, mode: "STORYTELLER" });
  return { spotId: spot.id, spotName: spot.name, opkCategory: spot.opkCategory, verifiedSource: spot.quest.verifiedLoreSource, riddleTitle: spot.quest.riddleTitle, ...result };
});
app.post("/api/ai/lens-verify", async (request, reply) => {
  const isMultipart = request.isMultipart(); let spotId = ""; let lat: string | undefined; let lng: string | undefined; let accuracyMeters: string | undefined; let customImageName: string | undefined; let sampleId: string | undefined; let imageBuffer: Buffer | undefined; let imageType = "";
  if (isMultipart) {
    const parts = request.parts(); for await (const part of parts) {
      if (part.type === "file") { if (part.fieldname !== "image") { await part.toBuffer(); continue; } imageType = part.mimetype; imageBuffer = await part.toBuffer(); }
      else if (part.fieldname === "spotId") spotId = String(part.value);
      else if (part.fieldname === "lat") lat = String(part.value);
      else if (part.fieldname === "lng") lng = String(part.value);
      else if (part.fieldname === "accuracyMeters") accuracyMeters = String(part.value);
    }
    if (!imageBuffer) return bad(reply, "Foto belum dilampirkan.");
    if (!imageTypes.has(imageType)) return error(reply, 415, "Format foto harus JPEG, PNG, atau WebP.", "IMAGE_TYPE_UNSUPPORTED");
    if (!imageSignatureMatches(imageType, imageBuffer)) return error(reply, 415, "Isi foto tidak sesuai dengan format berkasnya.", "IMAGE_TYPE_UNSUPPORTED");
  } else {
    const body = request.body as { spotId?: string; sampleId?: string; customImageName?: string; lat?: number; lng?: number; accuracyMeters?: number };
    spotId = body.spotId ?? ""; sampleId = body.sampleId; customImageName = body.customImageName; lat = body.lat === undefined ? undefined : String(body.lat); lng = body.lng === undefined ? undefined : String(body.lng); accuracyMeters = body.accuracyMeters === undefined ? undefined : String(body.accuracyMeters);
  }
  const user = requestUser(request); const row = spotId ? await getSpot(spotId) : null; if (!row || !(await spotVisibleTo(user, spotId))) return error(reply, 404, "Titik lokasi tidak ditemukan.");
  if (geofence(reply, { lat, lng, accuracyMeters }, row.payload, "memindai objek")) return;
  const visitorKey = user?.id ?? `guest:${sha(request.ip)}`;
  const dailyScan = await pool.query("SELECT 1 FROM entities WHERE kind='voucher' AND owner_id=$1 AND payload->>'spotId'=$2 AND payload->>'origin'='LENS_SCAN' AND created_at >= date_trunc('day',now()) LIMIT 1", [visitorKey, row.id]);
  if (dailyScan.rowCount) return error(reply, 409, "Kamu sudah mendapatkan voucer dari titik ini hari ini.", "SCAN_LIMIT_REACHED");
  if (imageBuffer && imageBuffer.length < 8192) return { isVerified: false, confidenceScore: 0.12, detectedObjectName: "", culturalStory: "", opkReference: row.payload.opkCategory, verifiedSource: "", awardedPoints: 0, message: "Objek belum dikenali. Coba foto lebih dekat, terang, dan fokus ke satu objek." };
  if (!imageBuffer) return error(reply, 400, "Kirim foto objek sebagai multipart/form-data.");
  if (!process.env.NINE_ROUTER_API_KEY) return { isVerified: false, confidenceScore: 0, detectedObjectName: "", culturalStory: "", opkReference: row.payload.opkCategory, verifiedSource: "", awardedPoints: 0, message: "Verifikasi foto belum tersedia. Coba lagi setelah layanan AI aktif." };
  const prompt = `Verifikasi apakah foto utama menunjukkan objek budaya yang diminta. Objek sasaran: ${row.payload.quest.targetObjectPrompt}. Foto berikutnya, jika ada, adalah foto referensi dari mitra. Jangan menebak. Gunakan hanya sumber terverifikasi ${row.payload.quest.verifiedLoreSource} dan kategori ${row.payload.opkCategory}. Balas JSON dengan isVerified boolean, confidenceScore 0..1, detectedObjectName, culturalStory, dan message jika tidak cocok.`;
  const controller = new AbortController(); const aiTimer = setTimeout(() => controller.abort(), 30000);
  let aiResult: { isVerified?: boolean; confidenceScore?: number; detectedObjectName?: string; culturalStory?: string; message?: string };
  try {
    const referenceParts = await Promise.all((row.payload.quest.referenceImages ?? []).map(async (reference) => {
      const saved = await pool.query<{ file_data: Buffer; mime_type: string }>("SELECT file_data,mime_type FROM entities WHERE kind='reference-image' AND id=$1", [reference.id]);
      const item = saved.rows[0]; return item ? { type: "image_url", image_url: { url: `data:${item.mime_type};base64,${item.file_data.toString("base64")}` } } : null;
    }));
    const response = await fetch(`${process.env.NINE_ROUTER_BASE_URL || "https://api.9router.local/v1"}/chat/completions`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.NINE_ROUTER_API_KEY}` }, signal: controller.signal,
      body: JSON.stringify({ model: process.env.NINE_ROUTER_MODEL || "gemini-2.5-flash", response_format: { type: "json_object" }, messages: [
        { role: "system", content: "Anda memverifikasi objek budaya secara konservatif. Jika ragu, isVerified false. Jangan mengarang fakta." },
        { role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: `data:${imageType};base64,${imageBuffer.toString("base64")}` } }, ...referenceParts.filter((part): part is NonNullable<typeof part> => part !== null)] },
      ] }),
    });
    if (!response.ok) throw new Error(`Layanan AI membalas ${response.status}`);
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    aiResult = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
  } catch (cause) {
    app.log.warn({ err: cause }, "Verifikasi AI gagal");
    return { isVerified: false, confidenceScore: 0, detectedObjectName: "", culturalStory: "", opkReference: row.payload.opkCategory, verifiedSource: "", awardedPoints: 0, message: "Foto belum dapat diverifikasi. Coba lagi sebentar." };
  } finally { clearTimeout(aiTimer); }
  if (aiResult.isVerified !== true || Number(aiResult.confidenceScore) < 0.65) return { isVerified: false, confidenceScore: Math.max(0, Math.min(1, Number(aiResult.confidenceScore) || 0)), detectedObjectName: aiResult.detectedObjectName ?? "", culturalStory: "", opkReference: row.payload.opkCategory, verifiedSource: row.payload.quest.verifiedLoreSource, awardedPoints: 0, message: aiResult.message || "Objek belum cocok dengan misi. Coba foto yang lebih dekat dan jelas." };
  const client = await pool.connect();
  const code = await uniqueCode("voucher", "LKW", "code");
  const reward = row.payload.quest.voucherReward; const voucher: IssuedVoucher = { code, signatureHash: crypto.createHmac("sha256", process.env.SESSION_SECRET!).update(`${code}:${row.id}`).digest("hex"), spotId: row.id, merchantName: reward.merchantName, discountTitle: reward.discountTitle, discountAmount: reward.discountAmount, minimumSpend: reward.minimumSpend, expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(), status: "ACTIVE", origin: "LENS_SCAN" } as IssuedVoucher;
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`lens:${visitorKey}:${row.id}:${new Date().toISOString().slice(0, 10)}`]);
    const alreadyScanned = await client.query("SELECT 1 FROM entities WHERE kind='voucher' AND owner_id=$1 AND payload->>'spotId'=$2 AND payload->>'origin'='LENS_SCAN' AND created_at >= date_trunc('day',now()) LIMIT 1", [visitorKey, row.id]);
    if (alreadyScanned.rowCount) { await client.query("ROLLBACK"); return error(reply, 409, "Kamu sudah mendapatkan voucer dari titik ini hari ini.", "SCAN_LIMIT_REACHED"); }
    await client.query("INSERT INTO entities(id,kind,owner_id,payload) VALUES($1,'voucher',$2,$3)", [code, visitorKey, JSON.stringify(voucher)]);
    if (user) {
      const prof = await profile(user.id); const card: UnlockedLoreCard = { id: id("lore"), spotId: row.id, objectName: aiResult.detectedObjectName || row.payload.quest.targetObjectPrompt, opkCategory: row.payload.opkCategory, verifiedSource: row.payload.quest.verifiedLoreSource, story: aiResult.culturalStory || row.payload.quest.loreNarrative, unlockedAt: new Date().toISOString(), confidenceScore: Number(aiResult.confidenceScore) };
      await client.query("UPDATE profiles SET xp=xp+$1,lore_cards=$2 WHERE user_id=$3", [row.payload.quest.rewardPoints, JSON.stringify([card, ...prof.lore_cards]), user.id]);
    }
    await client.query("COMMIT");
  } catch (cause) { await client.query("ROLLBACK"); throw cause; } finally { client.release(); }
  return { isVerified: true, confidenceScore: Math.max(0.65, Math.min(1, Number(aiResult.confidenceScore) || 0)), detectedObjectName: customImageName || aiResult.detectedObjectName || row.payload.quest.targetObjectPrompt, culturalStory: aiResult.culturalStory || row.payload.quest.loreNarrative, opkReference: row.payload.opkCategory, verifiedSource: row.payload.quest.verifiedLoreSource, awardedPoints: row.payload.quest.rewardPoints, issuedVoucher: voucher };
});

async function start() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL wajib diisi.");
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) throw new Error("SESSION_SECRET minimal 32 karakter.");
  await migrate();
  for (const spot of INITIAL_CULTURAL_SPOTS) {
    const seeded = { ...spot, status: spot.status ?? "PUBLISHED" as const };
    await pool.query("INSERT INTO entities(id,kind,owner_id,payload) VALUES($1,'spot',NULL,$2) ON CONFLICT(id) DO NOTHING", [seeded.id, JSON.stringify(seeded)]);
  }
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    const adminEmail = process.env.ADMIN_EMAIL.trim().toLowerCase();
    const salt = crypto.randomBytes(16).toString("hex");
    await pool.query("INSERT INTO users(id,email,name,role,password_salt,password_hash,email_verified) VALUES($1,$2,$3,'ADMIN',$4,$5,true) ON CONFLICT(email) DO NOTHING", ["admin-bootstrap", adminEmail, process.env.ADMIN_NAME ?? "Pengelola LOKAWIRA", salt, hashPassword(process.env.ADMIN_PASSWORD, salt)]);
    await pool.query("INSERT INTO profiles(user_id) SELECT id FROM users WHERE email=$1 ON CONFLICT DO NOTHING", [adminEmail]);
  }
  const port = Number(process.env.BACKEND_PORT) || 4000;
  await app.listen({ port, host: process.env.BACKEND_HOST ?? "0.0.0.0" });
}

for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, async () => { await app.close(); await closePool(); process.exit(0); });
start().catch(async (cause) => { app.log.error(cause); await closePool(); process.exit(1); });
