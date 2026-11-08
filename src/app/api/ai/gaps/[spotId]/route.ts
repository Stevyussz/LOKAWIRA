import { NextRequest, NextResponse } from "next/server";
import { getLokawiraStore } from "@/lib/seedCulturalData";
import { lokaGapLog, mockDisabled, requireRole } from "@/lib/server/mockBackend";
import { groupGaps } from "@/lib/server/loka";

type Ctx = { params: Promise<{ spotId: string }> };

// DELETE /api/ai/gaps/{spotId}: tandai pertanyaan di titik ini sudah ditangani (mis. rujukannya sudah ditambah)
export async function DELETE(request: NextRequest, ctx: Ctx) {
  const off = mockDisabled();
  if (off) return off;
  const auth = requireRole(request, ["ADMIN"]);
  if ("res" in auth) return auth.res;
  const { spotId } = await ctx.params;
  const log = lokaGapLog();
  for (let i = log.length - 1; i >= 0; i--) if (log[i].spotId === spotId) log.splice(i, 1);
  return NextResponse.json({ gaps: groupGaps(log, getLokawiraStore().spots) });
}
