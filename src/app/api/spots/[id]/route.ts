import { NextRequest, NextResponse } from "next/server";
import { getLokawiraStore } from "@/lib/seedCulturalData";
import { jsonError, merchantBlocked, mockDisabled, ownsSpot, requireRole, visibleSpots } from "@/lib/server/mockBackend";
import type { UpdateSpotRequest } from "@/types/api";

type Ctx = { params: Promise<{ id: string }> };

// PATCH /api/spots/{id}: mitra cuma lapak miliknya, field sensitif cuma dr ADMIN
export async function PATCH(request: NextRequest, ctx: Ctx) {
  const off = mockDisabled();
  if (off) return off;
  const auth = requireRole(request, ["MERCHANT", "ADMIN"]);
  if ("res" in auth) return auth.res;
  const blocked = merchantBlocked(auth.user);
  if (blocked) return blocked;
  const { id } = await ctx.params;
  const store = getLokawiraStore();
  const target = store.spots.find((s) => s.id === id);
  if (!target || target.status === "ARCHIVED") return jsonError(404, "Titik lokasi tidak ditemukan.");
  if (!ownsSpot(auth.user, id)) return jsonError(403, "Ini bukan lapak Anda.", "NOT_YOUR_SPOT");

  let body: UpdateSpotRequest;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Format permintaan tidak valid.");
  }
  const isAdmin = auth.user.role === "ADMIN";
  const before = { name: target.name, lat: target.coordinates.lat, lng: target.coordinates.lng };

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (name.length < 3) return jsonError(400, "Nama minimal 3 karakter.");
    target.name = name;
    target.quest.voucherReward.merchantName = name;
  }
  if (body.address !== undefined) {
    const a = String(body.address).trim();
    if (a.length < 5) return jsonError(400, "Alamat terlalu pendek.");
    target.address = a;
  }
  if (body.facilities !== undefined) {
    if (!Array.isArray(body.facilities)) return jsonError(400, "Fasilitas tidak valid.");
    target.facilities = body.facilities.map(String).slice(0, 12);
  }
  if (body.coordinates !== undefined) {
    const lat = Number(body.coordinates.lat);
    const lng = Number(body.coordinates.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return jsonError(400, "Koordinat tidak valid.");
    target.coordinates = { lat, lng };
  }
  if (body.quota?.maxCapacity !== undefined) {
    const cap = Number(body.quota.maxCapacity);
    if (!Number.isFinite(cap) || cap < 1 || cap > 500) return jsonError(400, "Kapasitas 1 sampai 500 orang.");
    target.quota.maxCapacity = cap;
    target.quota.currentVisitors = Math.min(target.quota.currentVisitors, cap);
  }
  if (body.quest) {
    const q = body.quest;
    if (q.riddleTitle !== undefined) target.quest.riddleTitle = String(q.riddleTitle).trim();
    if (q.riddleClue !== undefined) {
      const c = String(q.riddleClue).trim();
      if (c.length < 10) return jsonError(400, "Petunjuk misi minimal 10 karakter.");
      target.quest.riddleClue = c;
    }
    if (q.loreNarrative !== undefined) target.quest.loreNarrative = String(q.loreNarrative).trim();
    if (q.targetObjectPrompt !== undefined) target.quest.targetObjectPrompt = String(q.targetObjectPrompt).trim();
    if (isAdmin && q.verifiedLoreSource !== undefined) target.quest.verifiedLoreSource = String(q.verifiedLoreSource).trim();
    if (isAdmin && q.rewardPoints !== undefined) {
      target.quest.rewardPoints = Math.max(0, Math.min(1000, Number(q.rewardPoints) || 0));
    }
  }
  // mitra ngubah nama atau lokasi: titik balik ditinjau ulang pengelola (sesuai BACKEND_INTEGRATION bagian 7B)
  const moved = target.coordinates.lat !== before.lat || target.coordinates.lng !== before.lng;
  if (!isAdmin && (target.name !== before.name || moved)) target.status = "PENDING_REVIEW";
  if (isAdmin) {
    if (body.spotType) target.spotType = body.spotType;
    if (body.opkCategory) target.opkCategory = body.opkCategory;
    if (body.vibe) target.vibe = body.vibe;
    if (body.regionName) target.regionName = String(body.regionName);
  }
  return NextResponse.json({ spot: target, spots: visibleSpots(auth.user) });
}

// DELETE /api/spots/{id}: soft delete (ARCHIVED), data riwayat voucer & tiket tetap utuh
export async function DELETE(request: NextRequest, ctx: Ctx) {
  const off = mockDisabled();
  if (off) return off;
  const auth = requireRole(request, ["MERCHANT", "ADMIN"]);
  if ("res" in auth) return auth.res;
  const { id } = await ctx.params;
  const store = getLokawiraStore();
  const target = store.spots.find((s) => s.id === id);
  if (!target || target.status === "ARCHIVED") return jsonError(404, "Titik lokasi tidak ditemukan.");
  if (!ownsSpot(auth.user, id)) return jsonError(403, "Ini bukan lapak Anda.", "NOT_YOUR_SPOT");
  if (target.spotType === "PRIMARY_DEST" && auth.user.role !== "ADMIN") {
    return jsonError(403, "Cagar budaya utama hanya bisa diarsipkan pengelola.", "FORBIDDEN");
  }
  target.status = "ARCHIVED";
  return NextResponse.json({ spots: visibleSpots(auth.user) });
}
