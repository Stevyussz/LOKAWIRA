import { NextRequest, NextResponse } from "next/server";
import { getLokawiraStore } from "@/lib/seedCulturalData";
import { mockDisabled, requireRole } from "@/lib/server/mockBackend";
import { pageOf } from "@/lib/server/paging";

// GET /api/admin/vouchers?spotId=&status=&limit=&cursor= (ADMIN, terbaru dulu)
export async function GET(request: NextRequest) {
  const off = mockDisabled();
  if (off) return off;
  const auth = requireRole(request, ["ADMIN"]);
  if ("res" in auth) return auth.res;
  const q = new URL(request.url).searchParams;
  const items = getLokawiraStore().vouchers.filter(
    (v) => (!q.get("spotId") || v.spotId === q.get("spotId")) && (!q.get("status") || v.status === q.get("status"))
  );
  const { slice, nextCursor } = pageOf(items, q.get("limit"), q.get("cursor"));
  return NextResponse.json({ vouchers: slice, ...(nextCursor ? { nextCursor } : {}) });
}
