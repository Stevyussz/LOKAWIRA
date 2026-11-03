import { NextRequest, NextResponse } from "next/server";
import { getLokawiraStore } from "@/lib/seedCulturalData";
import { jsonError, merchantBlocked, mockDisabled, ownsSpot, requireRole, visibleSpots } from "@/lib/server/mockBackend";

type Ctx = { params: Promise<{ id: string }> };

// PUT /api/spots/{id}/promo: ganti templat promo voucer lapak (bukan nerbitin voucer)
export async function PUT(request: NextRequest, ctx: Ctx) {
  const off = mockDisabled();
  if (off) return off;
  const auth = requireRole(request, ["MERCHANT", "ADMIN"]);
  if ("res" in auth) return auth.res;
  const blocked = merchantBlocked(auth.user);
  if (blocked) return blocked;
  const { id } = await ctx.params;
  const target = getLokawiraStore().spots.find((s) => s.id === id);
  if (!target) return jsonError(404, "Titik lokasi tidak ditemukan.");
  if (!ownsSpot(auth.user, target.id)) return jsonError(403, "Ini bukan lapak Anda.", "NOT_YOUR_SPOT");
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Format permintaan tidak valid.");
  }
  const amount = Number(body.discountAmount);
  const minSpend = Number(body.minimumSpend);
  const title = String(body.discountTitle ?? "").trim();
  if (!title) return jsonError(400, "Judul promo wajib diisi.");
  if (!Number.isFinite(amount) || amount < 1000 || amount > 100000) return jsonError(400, "Nominal diskon harus Rp1.000 sampai Rp100.000.");
  if (!Number.isFinite(minSpend) || minSpend < 0 || minSpend > 10_000_000) return jsonError(400, "Minimal belanja tidak valid.");
  target.quest.voucherReward = { ...target.quest.voucherReward, discountTitle: title, discountAmount: amount, minimumSpend: minSpend };
  // Hany penglola yg bole mengubah XP misi (ekonomi gamifikasi).
  if (auth.user.role === "ADMIN" && Number.isFinite(Number(body.rewardPoints))) {
    target.quest.rewardPoints = Math.max(0, Math.min(1000, Number(body.rewardPoints)));
  }
  return NextResponse.json({ spot: target, spots: visibleSpots(auth.user) });
}
