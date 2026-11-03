import { NextRequest, NextResponse } from "next/server";
import { getLokawiraStore } from "@/lib/seedCulturalData";
import { jsonError, mockDisabled, requireRole, visibleSpots } from "@/lib/server/mockBackend";

type Ctx = { params: Promise<{ id: string }> };

// PATCH /api/spots/{id}/quota: pengelola isi jumlah pengunjung sekarang (koreksi manual)
export async function PATCH(request: NextRequest, ctx: Ctx) {
  const off = mockDisabled();
  if (off) return off;
  const auth = requireRole(request, ["ADMIN"]);
  if ("res" in auth) return auth.res;
  const { id } = await ctx.params;
  let body: { currentVisitors?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Format permintaan tidak valid.");
  }
  const n = Number(body.currentVisitors);
  if (!Number.isFinite(n)) return jsonError(400, "currentVisitors harus angka.");
  const target = getLokawiraStore().spots.find((s) => s.id === id);
  if (!target) return jsonError(404, "Titik lokasi tidak ditemukan");
  target.quota.currentVisitors = Math.max(0, Math.min(target.quota.maxCapacity, n));
  const ratio = target.quota.currentVisitors / target.quota.maxCapacity;
  target.quota.estimatedWaitMinutes = ratio >= 0.85 ? 35 : ratio >= 0.6 ? 15 : 0;
  return NextResponse.json({ spot: target, spots: visibleSpots(auth.user) });
}
