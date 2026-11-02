import { NextRequest, NextResponse } from "next/server";
import { consumeResetToken, jsonError, mockDisabled, setPassword } from "@/lib/server/mockBackend";

// POST /api/auth/reset-password {token,password}
export async function POST(request: NextRequest) {
  const off = mockDisabled();
  if (off) return off;
  const body = await request.json().catch(() => ({}));
  const password = String(body.password ?? "");
  if (password.length < 8) return jsonError(400, "Kata sandi minimal 8 karakter.");
  const user = consumeResetToken(String(body.token ?? ""));
  if (!user) return jsonError(400, "Tautan sudah tidak berlaku. Minta tautan baru.", "TOKEN_INVALID_OR_EXPIRED");
  setPassword(user, password);
  return NextResponse.json({ ok: true });
}
