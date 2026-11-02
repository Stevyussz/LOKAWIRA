import { mockDisabled } from "@/lib/server/mockBackend";
import { NextRequest, NextResponse } from "next/server";
import { currentUser, jsonError } from "@/lib/server/mockBackend";

export async function GET(request: NextRequest) {
  const off = mockDisabled();
  if (off) return off;
  const user = currentUser(request);
  if (!user) return jsonError(401, "Sesi tidak ditemukan atau sudah berakhir.", "UNAUTHENTICATED");
  return NextResponse.json({ user });
}
