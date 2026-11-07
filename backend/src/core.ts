import crypto from "node:crypto";
import type { AuthUser, CulturalSpot, Region, UnlockedLoreCard } from "@/types/lokawira";
import { openState } from "@/lib/spotRules";
import { matchRegion } from "@/lib/regionMatch";
import type { Db } from "./db.js";

// galat HTTP yg dilempar dr handler; error handler global yg ngubah jadi {error, code, details}
export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string, public details?: Record<string, unknown>) {
    super(message);
  }
}
export function fail(status: number, message: string, code?: string, details?: Record<string, unknown>): never {
  throw new HttpError(status, message, code, details);
}
export function bad(message = "Data yang dikirim belum valid."): never {
  return fail(400, message, "BAD_REQUEST");
}

export const newId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
export const sha = (v: string) => crypto.createHash("sha256").update(v).digest("hex");
export const hashPassword = (password: string, salt: string) => crypto.scryptSync(password, salt, 64).toString("hex");
export function passwordMatches(password: string, salt: string, hash: string) {
  const a = Buffer.from(hashPassword(password, salt), "hex");
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// "hari" = tanggal kalender WIB, bkn UTC (dulu jam 00-07 WIB kehitung hari kemarin)
export const wibDay = (d = new Date()) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
export const endOfWibDay = () => new Date(`${wibDay()}T23:59:59+07:00`).toISOString();
export const isExpiredIso = (v?: string | null) => {
  if (!v || !/^\d{4}-\d{2}-\d{2}T/.test(v)) return false;
  const t = new Date(v).getTime();
  return Number.isFinite(t) && t < Date.now();
};

export type EntityRow<T> = { id: string; kind: string; owner_id: string | null; created_at: Date; payload: T };

export async function getEntity<T>(db: Db, kind: string, id: string, lock = false): Promise<EntityRow<T> | null> {
  const r = await db.query<EntityRow<T>>(
    `SELECT id,kind,owner_id,created_at,payload FROM entities WHERE kind=$1 AND id=$2${lock ? " FOR UPDATE" : ""}`,
    [kind, id]
  );
  return r.rows[0] ?? null;
}
export async function listEntities<T>(db: Db, kind: string): Promise<EntityRow<T>[]> {
  const r = await db.query<EntityRow<T>>("SELECT id,kind,owner_id,created_at,payload FROM entities WHERE kind=$1 ORDER BY created_at DESC, id", [kind]);
  return r.rows;
}
export async function saveEntity<T>(db: Db, kind: string, id: string, payload: T, ownerId: string | null = null) {
  await db.query(
    "INSERT INTO entities(id,kind,owner_id,payload) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET owner_id=EXCLUDED.owner_id, payload=EXCLUDED.payload",
    [id, kind, ownerId, JSON.stringify(payload)]
  );
}

export async function listRegions(db: Db): Promise<Region[]> {
  return (await listEntities<Region>(db, "region")).map((r) => r.payload).sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
}
export const visibleRegions = (all: Region[], isAdmin: boolean) => (isAdmin ? all : all.filter((r) => r.status === "ACTIVE"));
export const regionFor = (c: { lat: number; lng: number }, regions: Region[]) => matchRegion(c, regions);

// pasang kawasan dr koordinat: regionId, palet, nama kawasan
export function applyRegion(spot: CulturalSpot, region: Region | null) {
  if (region) {
    spot.regionId = region.id;
    spot.vibe = region.theme;
    spot.regionName = `${region.name}, ${region.label}`;
    delete spot.regionProposal;
  } else {
    delete spot.regionId;
  }
}

async function merchantStatuses(db: Db) {
  const r = await db.query<{ id: string; status: string | null }>("SELECT id,status FROM users WHERE role='MERCHANT'");
  return new Map(r.rows.map((x) => [x.id, x.status ?? "ACTIVE"]));
}
export async function ownerInactive(db: Db, ownerId: string | null | undefined) {
  if (!ownerId) return false;
  const r = await db.query<{ status: string | null }>("SELECT status FROM users WHERE id=$1 AND role='MERCHANT'", [ownerId]);
  return !!r.rows[0] && r.rows[0].status !== "ACTIVE";
}

// titik yg boleh dilihat user: publik cuma yg terbit, di kawasan AKTIF, pemiliknya aktif, & acaranya belum selesai.
// Pemilik & pengelola liat yg menunggu/ditolak. Arsip gak pernah
export async function visibleSpotRows(db: Db, user: AuthUser | null): Promise<EntityRow<CulturalSpot>[]> {
  const [rows, statuses, regions] = await Promise.all([listEntities<CulturalSpot>(db, "spot"), merchantStatuses(db), listRegions(db)]);
  const regionById = new Map(regions.map((r) => [r.id, r]));
  return rows.filter(({ payload: s, owner_id }) => {
    if (s.status === "ARCHIVED") return false;
    const privileged = user?.role === "ADMIN" || (!!user && owner_id === user.id);
    if (privileged) return true;
    if (owner_id && statuses.get(owner_id) !== "ACTIVE") return false;
    const r = s.regionId ? regionById.get(s.regionId) : undefined;
    if (!r || r.status !== "ACTIVE") return false;
    if (s.event && openState(s).status === "ENDED") return false;
    return !s.status || s.status === "PUBLISHED";
  });
}
export const visibleSpots = async (db: Db, user: AuthUser | null) => (await visibleSpotRows(db, user)).map((r) => r.payload);
export async function findVisibleSpot(db: Db, user: AuthUser | null, spotId: unknown) {
  const id = typeof spotId === "string" ? spotId : "";
  return id ? (await visibleSpotRows(db, user)).find((r) => r.id === id) ?? null : null;
}

export const ownsRow = (user: AuthUser, row: { owner_id: string | null }) => user.role === "ADMIN" || row.owner_id === user.id;
export async function ownedSpotIds(db: Db, user: AuthUser): Promise<Set<string> | "ALL"> {
  if (user.role === "ADMIN") return "ALL";
  const r = await db.query<{ id: string }>("SELECT id FROM entities WHERE kind='spot' AND owner_id=$1", [user.id]);
  return new Set(r.rows.map((x) => x.id));
}

// klaim hadiah sekali per akun/titik/jenis/hari WIB. Atomik lewat primary key (aman walau dipanggil barengan)
export async function claimOnce(db: Db, userId: string, spotId: string, kind: "SCAN" | "RESERVATION" | "REDIRECT" | "CHECKIN") {
  const r = await db.query("INSERT INTO reward_log(user_id,spot_id,kind,day) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING 1", [userId, spotId, kind, wibDay()]);
  return r.rowCount === 1;
}

export async function addXp(db: Db, userId: string | null | undefined, points: number) {
  if (!userId || !(points > 0)) return;
  await db.query("INSERT INTO profiles(user_id,xp) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET xp=profiles.xp+EXCLUDED.xp", [userId, points]);
}
export async function profileOf(db: Db, userId: string) {
  await db.query("INSERT INTO profiles(user_id) VALUES($1) ON CONFLICT DO NOTHING", [userId]);
  const r = await db.query<{ xp: number; lore_cards: UnlockedLoreCard[] }>("SELECT xp,lore_cards FROM profiles WHERE user_id=$1", [userId]);
  return r.rows[0];
}

export async function uniqueCode(db: Db, kind: string, prefix: string, field: "code" | "ticketId") {
  for (let i = 0; i < 20; i++) {
    const code = `${prefix}-${crypto.randomInt(100000, 1000000)}`;
    const hit = await db.query("SELECT 1 FROM entities WHERE kind=$1 AND payload->>$2=$3", [kind, field, code]);
    if (!hit.rowCount) return code;
  }
  throw new Error("Tidak bisa membuat kode unik.");
}

// limiter berbagi state di Postgres (aman utk beberapa instance)
export async function consumeRateLimit(db: Db, key: string, limit: number, windowSeconds: number) {
  const r = await db.query<{ allowed: boolean }>(
    "INSERT INTO rate_limits(key,count,reset_at) VALUES($1,1,now()+($3::text||' seconds')::interval) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN rate_limits.reset_at<now() THEN 1 ELSE rate_limits.count+1 END,reset_at=CASE WHEN rate_limits.reset_at<now() THEN now()+($3::text||' seconds')::interval ELSE rate_limits.reset_at END RETURNING count <= $2 AS allowed",
    [key, limit, windowSeconds]
  );
  return r.rows[0]?.allowed === true;
}
export async function rateLimit(db: Db, key: string, limit: number, windowSeconds: number, message: string) {
  if (!(await consumeRateLimit(db, key, limit, windowSeconds))) fail(429, message, "RATE_LIMITED");
}

// signature voucer (HMAC) biar kode gak bisa dikarang di luar server
export const voucherSignature = (code: string, spotId: string) =>
  crypto.createHmac("sha256", process.env.SESSION_SECRET as string).update(`${code}:${spotId}`).digest("hex");

export const estimatedWait = (current: number, capacity: number) => {
  const ratio = capacity ? current / capacity : 0;
  return ratio >= 0.85 ? 35 : ratio >= 0.6 ? 15 : 0;
};
