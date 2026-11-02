import { mockDisabled } from "@/lib/server/mockBackend";
import { NextRequest, NextResponse } from "next/server";
import { getMock, tokenFrom } from "@/lib/server/mockBackend";

export async function POST(request: NextRequest) {
  const off = mockDisabled();
  if (off) return off;
  const token = tokenFrom(request);
  if (token) getMock().sessions.delete(token);
  return NextResponse.json({ ok: true });
}
