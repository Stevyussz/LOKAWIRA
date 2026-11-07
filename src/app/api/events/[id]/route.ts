import { NextRequest, NextResponse } from "next/server";
import { getLokawiraStore } from "@/lib/seedCulturalData";
import { jsonError, mockDisabled, ownsSpot, requireRole } from "@/lib/server/mockBackend";

type Ctx = { params: Promise<{ id: string }> };

// DELETE /api/events/{id}: pemilik lapak atau pengelola. Ubah acara = hapus lalu tambah lagi (biar sederhana)
export async function DELETE(request: NextRequest, ctx: Ctx) {
  const off = mockDisabled();
  if (off) return off;
  const auth = requireRole(request, ["MERCHANT", "ADMIN"]);
  if ("res" in auth) return auth.res;
  const { id } = await ctx.params;
  const store = getLokawiraStore();
  const i = store.events.findIndex((e) => e.id === id);
  if (i < 0) return jsonError(404, "Acara tidak ditemukan.");
  if (!ownsSpot(auth.user, store.events[i].spotId)) return jsonError(403, "Ini bukan acara di lapak Anda.", "NOT_YOUR_SPOT");
  store.events.splice(i, 1);
  return NextResponse.json({ events: store.events.filter((x) => ownsSpot(auth.user, x.spotId)) });
}
