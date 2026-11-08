import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { getLokawiraStore } from "@/lib/seedCulturalData";
import { galleryImages, jsonError, merchantBlocked, mockDisabled, ownsSpot, requireRole } from "@/lib/server/mockBackend";
import { INFO_LIMITS } from "@/lib/spotRules";

type Ctx = { params: Promise<{ id: string }> };
const MAX_BYTES = 5 * 1024 * 1024;

// POST /api/spots/{id}/gallery: mitra pemilik / pengelola unggah foto suasana tempat (maks 6), keterangan opsional
export async function POST(request: NextRequest, ctx: Ctx) {
  const off = mockDisabled();
  if (off) return off;
  const auth = requireRole(request, ["MERCHANT", "ADMIN"]);
  if ("res" in auth) return auth.res;
  const blocked = merchantBlocked(auth.user);
  if (blocked) return blocked;
  const { id } = await ctx.params;
  const spot = getLokawiraStore().spots.find((s) => s.id === id);
  if (!spot || spot.status === "ARCHIVED") return jsonError(404, "Titik lokasi tidak ditemukan.");
  if (!ownsSpot(auth.user, id)) return jsonError(403, "Ini bukan lapak Anda.", "NOT_YOUR_SPOT");

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError(400, "Kirim foto sebagai form-data dengan field image.");
  }
  const file = form.get("image");
  if (!(file instanceof File)) return jsonError(400, "Foto belum dilampirkan.");
  if (file.size > MAX_BYTES) return jsonError(413, "Foto lebih dari 5 MB.", "IMAGE_TOO_LARGE");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return jsonError(415, "Format foto harus JPEG, PNG, atau WebP.", "IMAGE_TYPE_UNSUPPORTED");
  const caption = String(form.get("caption") ?? "").trim().slice(0, INFO_LIMITS.caption);

  const list = (spot.gallery ??= []);
  if (list.length >= INFO_LIMITS.gallery) return jsonError(409, `Maksimal ${INFO_LIMITS.gallery} foto galeri per tempat. Hapus satu dulu.`, "TOO_MANY_IMAGES");
  const imageId = `gal-${crypto.randomBytes(5).toString("hex")}`;
  galleryImages().set(imageId, { type: file.type, data: Buffer.from(await file.arrayBuffer()) });
  list.push({ id: imageId, url: `/api/spots/${id}/gallery/${imageId}`, ...(caption ? { caption } : {}) });
  return NextResponse.json({ gallery: list });
}
