import { NextRequest, NextResponse } from "next/server";
import { deleteUser, demoAccountBlocked, jsonError, mockDisabled, requireRole, userRecord, verifyPassword } from "@/lib/server/mockBackend";

// DELETE /api/me {password} - hapus akun sendiri
export async function DELETE(request: NextRequest) {
  const off = mockDisabled();
  if (off) return off;
  const auth = requireRole(request, ["VISITOR", "MERCHANT", "ADMIN"]);
  if ("res" in auth) return auth.res;
  const locked = demoAccountBlocked(auth.user.id);
  if (locked) return locked;
  const body = await request.json().catch(() => ({}));
  const rec = userRecord(auth.user.id);
  if (!rec || !verifyPassword(rec, String(body.password ?? ""))) {
    return jsonError(401, "Kata sandi salah.", "BAD_CREDENTIALS");
  }
  deleteUser(auth.user.id);
  return NextResponse.json({ ok: true });
}
