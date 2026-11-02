import { NextRequest, NextResponse } from "next/server";
import { getLokawiraStore } from "@/lib/seedCulturalData";
import { jsonError, mockDisabled, requireRole, visibleSpots } from "@/lib/server/mockBackend";

// POST /api/admin/spots/{id}/review {decision: PUBLISH | REJECT}
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const off = mockDisabled();
  if (off) return off;
  const auth = requireRole(request, ["ADMIN"]);
  if ("res" in auth) return auth.res;
  const { id } = await ctx.params;
  const target = getLokawiraStore().spots.find((s) => s.id === id);
  if (!target || target.status === "ARCHIVED") return jsonError(404, "Titik lokasi tidak ditemukan.");
  let body: { decision?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Format permintaan tidak valid.");
  }
  if (body.decision !== "PUBLISH" && body.decision !== "REJECT") return jsonError(400, "Keputusan tidak valid.");
  target.status = body.decision === "PUBLISH" ? "PUBLISHED" : "REJECTED";
  return NextResponse.json({ spot: target, spots: visibleSpots(auth.user) });
}
