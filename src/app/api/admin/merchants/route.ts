import { NextRequest, NextResponse } from "next/server";
import { getLokawiraStore } from "@/lib/seedCulturalData";
import { listMerchantRecords, mockDisabled, requireRole } from "@/lib/server/mockBackend";
import type { MerchantSummary } from "@/types/api";

// GET /api/admin/merchants?status= - daftar mitra utk persetujuan
export async function GET(request: NextRequest) {
  const off = mockDisabled();
  if (off) return off;
  const auth = requireRole(request, ["ADMIN"]);
  if ("res" in auth) return auth.res;
  const status = new URL(request.url).searchParams.get("status");
  const spots = getLokawiraStore().spots;
  const merchants: MerchantSummary[] = listMerchantRecords()
    .filter((u) => !status || u.status === status)
    .map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      status: u.status ?? "ACTIVE",
      createdAt: u.createdAt,
      spotCount: spots.filter((s) => s.ownerId === u.id && s.status !== "ARCHIVED").length,
    }));
  return NextResponse.json({ merchants });
}
