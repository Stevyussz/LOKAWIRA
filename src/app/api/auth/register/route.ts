import { mockDisabled } from "@/lib/server/mockBackend";
import { NextRequest, NextResponse } from "next/server";
import { createUser, findUserByEmail, jsonError, publicUser, startSession } from "@/lib/server/mockBackend";

export async function POST(request: NextRequest) {
  const off = mockDisabled();
  if (off) return off;
  let body: { name?: string; email?: string; password?: string; role?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Format permintaan tidak valid.");
  }
  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  // Admin tida isa mendaftar sendri - Akun admin diibuat pengelola sistem
  const role = body.role === "MERCHANT" ? "MERCHANT" : body.role === "VISITOR" ? "VISITOR" : null;

  if (name.length < 2) return jsonError(400, "Nama minimal 2 karakter.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return jsonError(400, "Format email tidak valid.");
  if (password.length < 8) return jsonError(400, "Kata sandi minimal 8 karakter.");
  if (!role) return jsonError(400, "Jenis akun tidak valid.");
  if (findUserByEmail(email)) return jsonError(409, "Email ini sudah terdaftar. Silakan masuk.", "EMAIL_TAKEN");

  const user = createUser(name, email, role, password);
  return NextResponse.json({ token: startSession(user.id), user: publicUser(user) });
}
