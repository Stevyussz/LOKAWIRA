import { NextRequest, NextResponse } from "next/server";
import { getLokawiraStore } from "@/lib/seedCulturalData";
import { galleryImages, jsonError, merchantBlocked, mockDisabled, ownsSpot, requireRole } from "@/lib/server/mockBackend";

type Ctx = { params: Promise<{ id: string; imageId: string }> };

// GET: foto galeri (publik, buat <img>). Titik diarsip / ditolak: gak bisa dibuka
export async function GET(_req: NextRequest, ctx: Ctx) {
  const off = mockDisabled();
  if (off) return off;
  const { id, imageId } = await ctx.params;
  const spot = getLokawiraStore().spots.find((s) => s.id === id);
  const img = galleryImages().get(imageId);
  if (!spot || spot.status === "ARCHIVED" || spot.status === "REJECTED" || !img || !spot.gallery?.some((g) => g.id === imageId)) return jsonError(404, "Foto tidak ditemukan.");
  return new NextResponse(new Uint8Array(img.data), { headers: { "Content-Type": img.type, "Cache-Control": "public, max-age=3600", "X-Content-Type-Options": "nosniff" } });
}

// DELETE: mitra pemilik / pengelola menghapus satu foto galeri
export async function DELETE(request: NextRequest, ctx: Ctx) {
  const off = mockDisabled();
  if (off) return off;
  const auth = requireRole(request, ["MERCHANT", "ADMIN"]);
  if ("res" in auth) return auth.res;
  const blocked = merchantBlocked(auth.user);
  if (blocked) return blocked;
  const { id, imageId } = await ctx.params;
  const spot = getLokawiraStore().spots.find((s) => s.id === id);
  if (!spot || spot.status === "ARCHIVED") return jsonError(404, "Titik lokasi tidak ditemukan.");
  if (!ownsSpot(auth.user, id)) return jsonError(403, "Ini bukan lapak Anda.", "NOT_YOUR_SPOT");
  const list = spot.gallery ?? [];
  if (!list.some((g) => g.id === imageId)) return jsonError(404, "Foto galeri tidak ditemukan.");
  spot.gallery = list.filter((g) => g.id !== imageId);
  if (!spot.gallery.length) delete spot.gallery;
  galleryImages().delete(imageId);
  return NextResponse.json({ gallery: spot.gallery ?? [] });
}
