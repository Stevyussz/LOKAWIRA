import { NextRequest, NextResponse } from "next/server";
import { demoAccountBlocked, jsonError, mockDisabled, requireRole, setPassword, startSession, userRecord, verifyPassword } from "@/lib/server/mockBackend";

// POST /api/auth/change-password {currentPassword,newPassword}
export async function POST(request: NextRequest) {
  const off = mockDisabled();
  if (off) return off;
  const auth = requireRole(request, ["VISITOR", "MERCHANT", "ADMIN"]);
  if ("res" in auth) return auth.res;
  const locked = demoAccountBlocked(auth.user.id);
  if (locked) return locked;
  const body = await request.json().catch(() => ({}));
  const rec = userRecord(auth.user.id);
  if (!rec || !verifyPassword(rec, String(body.currentPassword ?? ""))) {
    return jsonError(401, "Kata sandi lama salah.", "BAD_CREDENTIALS");
  }
  const next = String(body.newPassword ?? "");
  if (next.length < 8) return jsonError(400, "Kata sandi baru minimal 8 karakter.");
  setPassword(rec, next);
  // sesi lama dicabut, kasih token baru biar perangkat ini tetap masuk
  return NextResponse.json({ ok: true, token: startSession(rec.id) });
}
