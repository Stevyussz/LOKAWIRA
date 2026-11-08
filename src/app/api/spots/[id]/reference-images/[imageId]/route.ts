import { NextRequest, NextResponse } from "next/server";
import { getLokawiraStore } from "@/lib/seedCulturalData";
import { jsonError, merchantBlocked, mockDisabled, ownsSpot, refImages, requireRole } from "@/lib/server/mockBackend";

type Ctx = { params: Promise<{ id: string; imageId: string }> };

// GET: foto contoh (publik, biar bisa ditampilkan di <img>)
export async function GET(_req: NextRequest, ctx: Ctx) {
  const off = mockDisabled();
  if (off) return off;
  const { id, imageId } = await ctx.params;
  const spot = getLokawiraStore().spots.find((s) => s.id === id);
  const img = refImages().get(imageId);
  // titik diarsip / ditolak: fotonya ikut gak bisa dibuka
  if (!spot || spot.status === "ARCHIVED" || spot.status === "REJECTED" || !img || !spot.quest.referenceImages?.some((r) => r.id === imageId)) return jsonError(404, "Foto tidak ditemukan.");
  return new NextResponse(new Uint8Array(img.data), { headers: { "Content-Type": img.type, "Cache-Control": "public, max-age=3600" } });
}

// DELETE: mitra pemilik / admin menghapus satu foto contoh
export async function DELETE(request: NextRequest, ctx: Ctx) {
  const off = mockDisabled();
  if (off) return off;
  const auth = requireRole(request, ["MERCHANT", "ADMIN"]);
  if ("res" in auth) return auth.res;
  const blocked = merchantBlocked(auth.user);
  if (blocked) return blocked;
  const { id, imageId } = await ctx.params;
  const spot = getLokawiraStore().spots.find((s) => s.id === id);
  if (!spot) return jsonError(404, "Titik lokasi tidak ditemukan.");
  if (!ownsSpot(auth.user, id)) return jsonError(403, "Ini bukan lapak Anda.", "NOT_YOUR_SPOT");
  const list = spot.quest.referenceImages ?? [];
  if (!list.some((r) => r.id === imageId)) return jsonError(404, "Foto tidak ditemukan.");
  spot.quest.referenceImages = list.filter((r) => r.id !== imageId);
  refImages().delete(imageId);
  return NextResponse.json({ referenceImages: spot.quest.referenceImages });
}
