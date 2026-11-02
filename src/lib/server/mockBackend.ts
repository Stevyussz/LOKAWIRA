// SERVER cth (di memori) utk pengembangan & demo - bkn utk produksi
import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getLokawiraStore } from "@/lib/seedCulturalData";
import { AuthUser, MerchantStatus, UserRole } from "@/types/lokawira";

import { DEMO_MODE as DEMO } from "@/lib/api";

interface UserRecord extends AuthUser {
  salt: string;
  hash: string;
  createdAt: string;
}
export interface CheckInRecord {
  id: string;
  code: string;
  spotId: string;
  userId: string | null;
  createdAt: string;
  verified: boolean;
  verifiedAt?: string;
}
interface MockState {
  users: UserRecord[];
  sessions: Map<string, string>;
  failedLogins: Map<string, { count: number; until: number }>;
  checkIns: CheckInRecord[];
  resetTokens: Map<string, { userId: string; expires: number }>;
}

const g = globalThis as unknown as { lokawiraMock?: MockState };

const hashPassword = (password: string, salt: string) =>
  crypto.scryptSync(password, salt, 32).toString("hex");

function makeUser(
  id: string,
  name: string,
  email: string,
  role: UserRole,
  password: string,
  status?: MerchantStatus
): UserRecord {
  const salt = crypto.randomBytes(8).toString("hex");
  return {
    id,
    name,
    email: email.toLowerCase(),
    role,
    // mitra baru nunggu persetujuan pengelola - peran lain gak punya status
    status: role === "MERCHANT" ? (status ?? "PENDING") : undefined,
    createdAt: new Date().toISOString(),
    salt,
    hash: hashPassword(password, salt),
  };
}

export function getMock(): MockState {
  if (!g.lokawiraMock) {
    const users: UserRecord[] = [];
    if (DEMO) {
      // akun demo cuma dibuat di mode demo - Kata sandi demo ditampilkan di halaman masuk (berlabel demo)
      users.push(
        makeUser("u-wisatawan-1", "Wisatawan Demo", "wisatawan@lokawira.demo", "VISITOR", "demo1234"),
        makeUser("u-mitra-1", "Mitra Demo Trowulan", "mitra@lokawira.demo", "MERCHANT", "demo1234", "ACTIVE"),
        // calon mitra + 1 titiknya biar antrean persetujuan pengelola ada isinya pas demo
        makeUser("u-mitra-2", "Kedai Kopi Calon Mitra", "calon@lokawira.demo", "MERCHANT", "demo1234", "PENDING"),
        makeUser("u-admin-1", "Pengelola Demo", "admin@lokawira.demo", "ADMIN", "demo1234")
      );
      // Lapak cth milik mitra demo
      for (const s of getLokawiraStore().spots) {
        if (s.id === "spot-mjp-02" || s.id === "spot-mjp-03") s.ownerId = "u-mitra-1";
      }
      const base = getLokawiraStore().spots.find((s) => s.id === "spot-mjp-02");
      if (base && !getLokawiraStore().spots.some((s) => s.id === "spot-demo-pending")) {
        getLokawiraStore().spots.push({
          ...structuredClone(base),
          id: "spot-demo-pending",
          ownerId: "u-mitra-2",
          status: "PENDING_REVIEW",
          createdAt: new Date().toISOString(),
          name: "Kedai Kopi Pawon Trowulan",
          spotType: "UMKM_KULINER",
          opkCategory: "Pengetahuan Tradisional",
          address: "Jl. Raya Trowulan, sebelah balai desa",
          coordinates: { lat: base.coordinates.lat + 0.0012, lng: base.coordinates.lng + 0.0009 },
        });
      }
    }
    g.lokawiraMock = { users, sessions: new Map(), failedLogins: new Map(), checkIns: [], resetTokens: new Map() };
  }
  return g.lokawiraMock;
}

export const publicUser = (u: UserRecord): AuthUser => ({ id: u.id, name: u.name, email: u.email, role: u.role, status: u.status, statusReason: u.statusReason });

export function findUserByEmail(email: string) {
  return getMock().users.find((u) => u.email === email.toLowerCase().trim());
}

export function verifyPassword(user: UserRecord, password: string): boolean {
  const a = Buffer.from(hashPassword(password, user.salt), "hex");
  const b = Buffer.from(user.hash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function createUser(name: string, email: string, role: UserRole, password: string): UserRecord {
  const u = makeUser(`u-${crypto.randomBytes(5).toString("hex")}`, name, email, role, password);
  getMock().users.push(u);
  return u;
}

export function startSession(userId: string): string {
  const token = crypto.randomBytes(24).toString("hex");
  getMock().sessions.set(token, userId);
  return token;
}

export function tokenFrom(req: NextRequest): string | null {
  const h = req.headers.get("authorization");
  return h?.startsWith("Bearer ") ? h.slice(7) : null;
}

export function currentUser(req: NextRequest): AuthUser | null {
  const token = tokenFrom(req);
  if (!token) return null;
  const id = getMock().sessions.get(token);
  const u = id ? getMock().users.find((x) => x.id === id) : undefined;
  return u ? publicUser(u) : null;
}

const err = (status: number, error: string, code?: string) => NextResponse.json({ error, code }, { status });

// pagar peran - 401 kalo blm masuk, 403 kalo peran gak cukup
export function requireRole(req: NextRequest, roles: UserRole[]): { user: AuthUser } | { res: NextResponse } {
  const user = currentUser(req);
  if (!user) return { res: err(401, "Silakan masuk terlebih dahulu.", "UNAUTHENTICATED") };
  if (!roles.includes(user.role)) return { res: err(403, "Akunmu tidak punya izin untuk aksi ini.", "FORBIDDEN") };
  return { user };
}

// mitra cuma boleh mengurus lapak miiliknya - Admin boleh semuanya
export function ownsSpot(user: AuthUser, spotId: string): boolean {
  if (user.role === "ADMIN") return true;
  return getLokawiraStore().spots.some((s) => s.id === spotId && s.ownerId === user.id);
}

// mitra yg belum disetujui (atau ditolak) gak boleh mengelola lapak
export function merchantBlocked(user: AuthUser): NextResponse | null {
  if (user.role === "MERCHANT" && user.status && user.status !== "ACTIVE") {
    return err(
      403,
      user.status === "PENDING" ? "Akun mitramu masih menunggu persetujuan pengelola." : "Pendaftaran mitramu ditolak pengelola.",
      "ACCOUNT_NOT_APPROVED"
    );
  }
  return null;
}

export function listMerchantRecords() {
  return getMock().users.filter((u) => u.role === "MERCHANT");
}
export function setMerchantStatus(id: string, status: MerchantStatus, reason?: string): UserRecord | null {
  const u = getMock().users.find((x) => x.id === id && x.role === "MERCHANT");
  if (!u) return null;
  u.status = status;
  u.statusReason = status === "REJECTED" && reason ? reason.slice(0, 200) : undefined;
  return u;
}

// titik yg boleh dilihat user ini: publik cuma yg terbit, pemilik & pengelola lihat yg menunggu/ditolak, arsip gak pernah
export function visibleSpots(user: AuthUser | null) {
  return getLokawiraStore().spots.filter((s) => {
    if (s.status === "ARCHIVED") return false;
    if (!s.status || s.status === "PUBLISHED") return true;
    return user?.role === "ADMIN" || (!!user && s.ownerId === user.id);
  });
}

// akun demo bawaan itu publik - gak boleh diubah sandinya atau dihapus, biar pengunjung iseng gak mengunci akun orang lain
const DEMO_USER_IDS = new Set(["u-wisatawan-1", "u-mitra-1", "u-mitra-2", "u-admin-1"]);
export function demoAccountBlocked(userId: string): NextResponse | null {
  return DEMO && DEMO_USER_IDS.has(userId)
    ? err(403, "Akun demo bawaan tidak bisa diubah atau dihapus. Buat akun sendiri untuk mencoba.", "DEMO_ACCOUNT_LOCKED")
    : null;
}

export function userRecord(id: string) {
  return getMock().users.find((u) => u.id === id);
}

export function setPassword(user: UserRecord, password: string) {
  user.salt = crypto.randomBytes(8).toString("hex");
  user.hash = hashPassword(password, user.salt);
  // sandi berubah: sesi lain milik user ini ikut dicabut
  for (const [tok, uid] of getMock().sessions) if (uid === user.id) getMock().sessions.delete(tok);
}

export function createResetToken(userId: string): string {
  const token = crypto.randomBytes(20).toString("hex");
  getMock().resetTokens.set(token, { userId, expires: Date.now() + 30 * 60_000 });
  return token;
}
export function consumeResetToken(token: string): UserRecord | null {
  const rec = getMock().resetTokens.get(token);
  getMock().resetTokens.delete(token);
  if (!rec || Date.now() > rec.expires) return null;
  return userRecord(rec.userId) ?? null;
}

// hapus akun: sesi & check-in ikut hilang, titik milik mitra diarsipin (bukan dihapus mentah)
export function deleteUser(id: string) {
  const m = getMock();
  m.users = m.users.filter((u) => u.id !== id);
  for (const [tok, uid] of m.sessions) if (uid === id) m.sessions.delete(tok);
  m.checkIns = m.checkIns.filter((c) => c.userId !== id);
  for (const sp of getLokawiraStore().spots) if (sp.ownerId === id) sp.status = "ARCHIVED";
}

export function rateLimitLogin(email: string): NextResponse | null {
  const rec = getMock().failedLogins.get(email);
  if (rec && rec.count >= 5 && Date.now() < rec.until) {
    return err(429, "Terlalu banyak percobaan. Coba lagi sebentar lagi.", "RATE_LIMITED");
  }
  return null;
}
export function recordLoginFailure(email: string) {
  const m = getMock().failedLogins;
  const rec = m.get(email);
  m.set(email, { count: (rec?.count ?? 0) + 1, until: Date.now() + 60_000 });
}
export function clearLoginFailures(email: string) {
  getMock().failedLogins.delete(email);
}

export { err as jsonError };

// server cth cuma boleh hidup di mode demo
export function mockDisabled(): NextResponse | null {
  return DEMO
    ? null
    : err(503, "Backend belum tersambung. Isi NEXT_PUBLIC_API_BASE_URL ke server sungguhan.", "MOCK_DISABLED");
}
export const isDemoBackend = DEMO;
