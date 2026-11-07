import { NextRequest, NextResponse } from "next/server";
import { getLokawiraStore } from "@/lib/seedCulturalData";
import { jsonError, mockDisabled, requireRole } from "@/lib/server/mockBackend";
import { adoptOrphans } from "@/lib/server/regions";
import { parseRegion } from "@/lib/server/regionInput";

type Ctx = { params: Promise<{ id: string }> };

// PATCH /api/regions/{id}: ubah nama/lokasi/palet/radius/status (atomik). Palet baru ikut ke semua titiknya
export async function PATCH(request: NextRequest, ctx: Ctx) {
  const off = mockDisabled();
  if (off) return off;
  const auth = requireRole(request, ["ADMIN"]);
  if ("res" in auth) return auth.res;
  const { id } = await ctx.params;
  const store = getLokawiraStore();
  const target = store.regions.find((r) => r.id === id);
  if (!target) return jsonError(404, "Kawasan tidak ditemukan.");
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Format permintaan tidak valid.");
  }
  const parsed = parseRegion(body, target, true);
  if (typeof parsed === "string") return jsonError(400, parsed);
  if (store.regions.some((r) => r.id !== id && r.name.toLowerCase() === parsed.name.toLowerCase())) {
    return jsonError(409, "Nama kawasan sudah dipakai.", "REGION_NAME_TAKEN");
  }
  Object.assign(target, parsed, { id: target.id, createdAt: target.createdAt });
  // titik di kawasan ini ngikut nama & palet barunya
  for (const s of store.spots) {
    if (s.regionId !== id) continue;
    s.vibe = target.theme;
    s.regionName = `${target.name}, ${target.label}`;
  }
  const adopted = adoptOrphans();
  return NextResponse.json({ region: target, regions: store.regions, adopted });
}
