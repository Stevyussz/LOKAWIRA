import { NextRequest, NextResponse } from "next/server";
import { mockDisabled, requireRole } from "@/lib/server/mockBackend";

// POST /api/auth/resend-verification
export async function POST(request: NextRequest) {
  const off = mockDisabled();
  if (off) return off;
  const auth = requireRole(request, ["VISITOR", "MERCHANT", "ADMIN"]);
  if ("res" in auth) return auth.res;
  return NextResponse.json({ ok: true });
}
