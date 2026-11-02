import { NextRequest, NextResponse } from "next/server";
import { getLokawiraStore } from "@/lib/seedCulturalData";
import { jsonError, mockDisabled, requireRole, setMerchantStatus } from "@/lib/server/mockBackend";

// POST /api/admin/merchants/{id}/approve
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const off = mockDisabled();
  if (off) return off;
  const auth = requireRole(request, ["ADMIN"]);
  if ("res" in auth) return auth.res;
  const { id } = await ctx.params;
  const u = setMerchantStatus(id, "ACTIVE");
  if (!u) return jsonError(404, "Mitra tidak ditemukan.");
  const spotCount = getLokawiraStore().spots.filter((s) => s.ownerId === u.id && s.status !== "ARCHIVED").length;
  return NextResponse.json({
    merchant: { id: u.id, name: u.name, email: u.email, status: u.status, createdAt: u.createdAt, spotCount },
  });
}
