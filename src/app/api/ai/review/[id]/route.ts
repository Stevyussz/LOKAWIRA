import { NextRequest, NextResponse } from "next/server";
import { getLokawiraStore } from "@/lib/seedCulturalData";
import { aiRateLimited, jsonError, mockDisabled, refImages, requireRole } from "@/lib/server/mockBackend";
import { reviewSpot } from "@/lib/server/loka";
import type { ReviewSpotResponse } from "@/types/api";

type Ctx = { params: Promise<{ id: string }> };

// POST /api/ai/review/{id}: cek kelengkapan pengajuan + pemeriksaan Loka (teks & foto contoh), buat pengelola
export async function POST(request: NextRequest, ctx: Ctx) {
  const off = mockDisabled();
  if (off) return off;
  const auth = requireRole(request, ["ADMIN"]);
  if ("res" in auth) return auth.res;
  const { id } = await ctx.params;
  const spot = getLokawiraStore().spots.find((s) => s.id === id && s.status !== "ARCHIVED");
  if (!spot) return jsonError(404, "Titik lokasi tidak ditemukan.");
  const limited = aiRateLimited(`review:${auth.user.id}`, 30, 600_000);
  if (limited) return limited;
  const imgs = (spot.quest.referenceImages ?? []).map((r) => refImages().get(r.id)).filter((x): x is { type: string; data: Buffer } => !!x);
  const r = await reviewSpot(spot, imgs);
  return NextResponse.json(r satisfies ReviewSpotResponse);
}
