import { NextRequest, NextResponse } from "next/server";
import { jsonError, mockDisabled } from "@/lib/server/mockBackend";

// POST /api/auth/verify-email { token }
export async function POST(request: NextRequest) {
  const off = mockDisabled();
  if (off) return off;
  const body = await request.json().catch(() => ({}));
  const token = String(body.token ?? "").trim();
  if (!token) {
    return jsonError(400, "Tautan verifikasi tidak valid atau sudah kedaluwarsa.", "TOKEN_INVALID_OR_EXPIRED");
  }
  return NextResponse.json({ ok: true });
}
