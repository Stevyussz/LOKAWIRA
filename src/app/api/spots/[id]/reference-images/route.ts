import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { getLokawiraStore } from "@/lib/seedCulturalData";
import { jsonError, merchantBlocked, mockDisabled, ownsSpot, refImages, requireRole } from "@/lib/server/mockBackend";

type Ctx = { params: Promise<{ id: string }> };
const MAX_IMAGES = 5;
const MAX_BYTES = 5 * 1024 * 1024;

// POST /api/spots/{id}/reference-images: mitra unggah foto contoh objek yg dipindai wisatawan (maks 5)
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

  let file: FormDataEntryValue | null = null;
  try {
    file = (await request.formData()).get("image");
  } catch {
    return jsonError(400, "Kirim foto sebagai form-data dengan field image.");
  }
  if (!(file instanceof File)) return jsonError(400, "Foto belum dilampirkan.");
  if (file.size > MAX_BYTES) return jsonError(413, "Foto lebih dari 5 MB.", "IMAGE_TOO_LARGE");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return jsonError(415, "Format foto harus JPEG, PNG, atau WebP.", "IMAGE_TYPE_UNSUPPORTED");

  const list = (spot.quest.referenceImages ??= []);
  if (list.length >= MAX_IMAGES) return jsonError(409, `Maksimal ${MAX_IMAGES} foto contoh per lapak. Hapus satu dulu.`, "TOO_MANY_IMAGES");

  const imageId = `img-${crypto.randomBytes(5).toString("hex")}`;
  refImages().set(imageId, { type: file.type, data: Buffer.from(await file.arrayBuffer()) });
  list.push({ id: imageId, url: `/api/spots/${id}/reference-images/${imageId}` });
  return NextResponse.json({ referenceImages: list });
}
