import { NextRequest, NextResponse } from "next/server";
import { getLokawiraStore } from "@/lib/seedCulturalData";
import { lokaGapLog, mockDisabled, requireRole } from "@/lib/server/mockBackend";
import { groupGaps } from "@/lib/server/loka";

// GET /api/ai/gaps: pertanyaan wisatawan yg belum bisa dijawab Loka, dikelompokkan per titik (pengelola)
export async function GET(request: NextRequest) {
  const off = mockDisabled();
  if (off) return off;
  const auth = requireRole(request, ["ADMIN"]);
  if ("res" in auth) return auth.res;
  return NextResponse.json({ gaps: groupGaps(lokaGapLog(), getLokawiraStore().spots) });
}
