import crypto from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { AuthUser, MerchantStatus, UserRole } from "../../src/types/lokawira";
import { pool } from "./db.js";
import { fail, sha } from "./core.js";

export const SESSION_DAYS = 30;
export const COOKIE_MODE = process.env.SESSION_MODE === "cookie";
export const allowedOrigins = () => (process.env.CORS_ORIGINS ?? "http://localhost:3000").split(",").map((o) => o.trim()).filter(Boolean);

export type UserRow = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: string | null;
  status_reason: string | null;
  password_salt: string;
  password_hash: string;
  email_verified: boolean;
  created_at: Date;
};
export const USER_COLS = "id,name,email,role,status,status_reason,password_salt,password_hash,email_verified,created_at";

export function safeUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    ...(row.role === "MERCHANT" ? { status: (row.status ?? "ACTIVE") as MerchantStatus, ...(row.status_reason ? { statusReason: row.status_reason } : {}) } : {}),
  };
}

declare module "fastify" {
  interface FastifyRequest {
    authUser: AuthUser | null;
    sessionToken: string | null;
  }
}

function cookieToken(request: FastifyRequest) {
  const part = request.headers.cookie?.split(";").map((p) => p.trim()).find((p) => p.startsWith("lokawira.session="));
  return part ? part.slice("lokawira.session=".length) : null;
}

// baca sesi dr Bearer (default) atau cookie. Mutasi via cookie wajib dr origin yg diizinkan (anti CSRF)
export async function authHook(request: FastifyRequest) {
  if (COOKIE_MODE && !["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const origin = request.headers.origin;
    if (!origin || !allowedOrigins().includes(origin)) fail(403, "Origin tidak diizinkan.", "FORBIDDEN");
  }
  const h = request.headers.authorization;
  const token = h?.startsWith("Bearer ") ? h.slice(7) : COOKIE_MODE ? cookieToken(request) : null;
  if (!token) return;
  const r = await pool.query<UserRow>(
    `SELECT u.id,u.name,u.email,u.role,u.status,u.status_reason,u.password_salt,u.password_hash,u.email_verified,u.created_at
     FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()`,
    [sha(token)]
  );
  if (r.rows[0]) {
    request.authUser = safeUser(r.rows[0]);
    request.sessionToken = token;
  }
}

export const currentUser = (request: FastifyRequest) => request.authUser;

// 401 kalo blm masuk, 403 kalo peran kurang / mitra belum disetujui
export function requireRoles(request: FastifyRequest, roles: UserRole[], opts: { allowInactiveMerchant?: boolean } = {}): AuthUser {
  const user = request.authUser;
  if (!user) fail(401, "Silakan masuk terlebih dahulu.", "UNAUTHENTICATED");
  if (!roles.includes(user.role)) fail(403, "Akunmu tidak punya izin untuk aksi ini.", "FORBIDDEN");
  if (!opts.allowInactiveMerchant && user.role === "MERCHANT" && user.status !== "ACTIVE") {
    fail(403, user.status === "PENDING" ? "Akun mitramu masih menunggu persetujuan pengelola." : "Pendaftaran mitramu ditolak pengelola.", "ACCOUNT_NOT_APPROVED");
  }
  return user;
}

// terbitin sesi baru: token acak ke klien, yg disimpan cuma hash-nya
export async function issueSession(reply: FastifyReply, userId: string) {
  const token = crypto.randomBytes(32).toString("base64url");
  await pool.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '30 days')", [sha(token), userId]);
  if (COOKIE_MODE) {
    reply.header("Set-Cookie", `lokawira.session=${token}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=${SESSION_DAYS * 86400}`);
    return {};
  }
  return { token };
}
export function clearSessionCookie(reply: FastifyReply) {
  if (COOKIE_MODE) reply.header("Set-Cookie", "lokawira.session=; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0");
}

// akun uji publik (DEMO_ACCOUNTS=true) gak boleh diganti sandinya / dihapus, biar juri lain gak kekunci
export const DEMO_USER_IDS = new Set(["u-wisatawan-1", "u-mitra-1", "u-mitra-2", "u-admin-1"]);
export function blockDemoAccount(userId: string) {
  if (process.env.DEMO_ACCOUNTS === "true" && DEMO_USER_IDS.has(userId)) {
    fail(403, "Akun uji bawaan tidak bisa diubah atau dihapus. Buat akun sendiri untuk mencoba.", "DEMO_ACCOUNT_LOCKED");
  }
}

export const bodyOf = (request: FastifyRequest): Record<string, unknown> =>
  request.body && typeof request.body === "object" && !Array.isArray(request.body) ? (request.body as Record<string, unknown>) : {};
