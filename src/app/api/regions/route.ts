import { NextRequest, NextResponse } from "next/server";
import { getLokawiraStore } from "@/lib/seedCulturalData";
import { currentUser, jsonError, mockDisabled, requireRole } from "@/lib/server/mockBackend";
import { adoptOrphans, visibleRegions } from "@/lib/server/regions";
import { parseRegion } from "@/lib/server/regionInput";

// GET /api/regions: publik = kawasan aktif, pengelola = semua (termasuk draf)
export async function GET(request: NextRequest) {
  const off = mockDisabled();
  if (off) return off;
  return NextResponse.json({ regions: visibleRegions(currentUser(request)?.role === "ADMIN") });
}

// POST /api/regions: pengelola bikin kawasan baru. Lapak yatim di dlm radiusnya langsung ikut
export async function POST(request: NextRequest) {
  const off = mockDisabled();
  if (off) return off;
  const auth = requireRole(request, ["ADMIN"]);
  if ("res" in auth) return auth.res;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Format permintaan tidak valid.");
  }
  const store = getLokawiraStore();
  const parsed = parseRegion(body, {}, false);
  if (typeof parsed === "string") return jsonError(400, parsed);
  if (store.regions.some((r) => r.name.toLowerCase() === parsed.name.toLowerCase())) {
    return jsonError(409, "Nama kawasan sudah dipakai.", "REGION_NAME_TAKEN");
  }
  const slug = parsed.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "kawasan";
  let id = `rgn-${slug}`;
  for (let i = 2; store.regions.some((r) => r.id === id); i++) id = `rgn-${slug}-${i}`;
  const region = { ...parsed, id, createdAt: new Date().toISOString() };
  store.regions.push(region);
  const adopted = adoptOrphans();
  return NextResponse.json({ region, regions: store.regions, adopted }, { status: 201 });
}
