import { mockDisabled } from "@/lib/server/mockBackend";
import { NextRequest, NextResponse } from "next/server";
import {
  clearLoginFailures,
  findUserByEmail,
  jsonError,
  publicUser,
  rateLimitLogin,
  recordLoginFailure,
  startSession,
  verifyPassword,
} from "@/lib/server/mockBackend";

export async function POST(request: NextRequest) {
  const off = mockDisabled();
  if (off) return off;
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Format permintaan tidak valid.");
  }
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  if (!email || !password) return jsonError(400, "Email dan kata sandi wajib diisi.");

  const limited = rateLimitLogin(email);
  if (limited) return limited;

  const user = findUserByEmail(email);
  // pesan sama ntuk email tak dikennal da sandi salah, biar akun gak bisa ditebak
  if (!user || !verifyPassword(user, password)) {
    recordLoginFailure(email);
    return jsonError(401, "Email atau kata sandi salah.", "BAD_CREDENTIALS");
  }
  clearLoginFailures(email);
  return NextResponse.json({ token: startSession(user.id), user: publicUser(user) });
}
