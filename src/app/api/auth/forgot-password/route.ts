import { NextRequest, NextResponse } from "next/server";
import { createResetToken, findUserByEmail, mockDisabled, demoAccountBlocked } from "@/lib/server/mockBackend";
import { DEMO_MODE } from "@/lib/api";

// POST /api/auth/forgot-password {email} - SELALU ok, jgn bocorin email terdaftar atau tidak
export async function POST(request: NextRequest) {
  const off = mockDisabled();
  if (off) return off;
  const body = await request.json().catch(() => ({}));
  const user = findUserByEmail(String(body.email ?? ""));
  // server cth gak punya email: di mode demo token dibalikin biar alurnya bisa dicoba (server asli JANGAN begini)
  const eligible = user && !demoAccountBlocked(user.id);
  const demoToken = DEMO_MODE && eligible ? createResetToken(user.id) : undefined;
  return NextResponse.json({ ok: true, ...(demoToken ? { demoToken } : {}) });
}
