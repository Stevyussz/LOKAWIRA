import { mockDisabled } from "@/lib/server/mockBackend";
import { NextRequest, NextResponse } from "next/server";
import { getLokawiraStore } from "@/lib/seedCulturalData";
import { CulturalSpot, CulturalVibe } from "@/types/lokawira";
import { currentUser, jsonError, merchantBlocked, profileOf, requireRole, visibleSpots } from "@/lib/server/mockBackend";

export async function GET(request: NextRequest) {
  const off = mockDisabled();
  if (off) return off;
  const store = getLokawiraStore();
  const { searchParams } = new URL(request.url);
  const vibe = searchParams.get("vibe") as CulturalVibe | null;

  const user = currentUser(request);
  // arsip gak tampil, titik yg menunggu review cuma utk pemilik & pengelola
  const live = visibleSpots(user);
  const spots = vibe ? live.filter((spot) => spot.vibe === vibe) : live;

  // mitra hnya melihat voucer lapakny dn gak meliihat tiket wisatwan
  const mine = new Set(store.spots.filter((s) => s.ownerId === user?.id).map((s) => s.id));
  const isMerchant = user?.role === "MERCHANT";

  const prof = user?.role === "VISITOR" ? profileOf(user.id) : null;
  return NextResponse.json({
    spots,
    // tamu (belum login) gak dikasih voucer/tiket siapa pun: tas tamu cuma ada di perangkatnya. Admin dapat semua
    vouchers: prof
      ? store.vouchers.filter((v) => prof.voucherCodes.has(v.code))
      : isMerchant
      ? store.vouchers.filter((v) => mine.has(v.spotId))
      : user?.role === "ADMIN"
      ? store.vouchers
      : [],
    reservations: prof ? store.reservations.filter((r) => prof.ticketIds.has(r.ticketId)) : user?.role === "ADMIN" ? store.reservations : [],
    aiTrainingNotes: store.aiTrainingNotes,
  });
}

// POST /api/spots: tambah titik. Body = objek CulturalSpot langsung (bukan lagi dibungkus action)
export async function POST(request: NextRequest) {
  const off = mockDisabled();
  if (off) return off;
  const auth = requireRole(request, ["MERCHANT", "ADMIN"]);
  if ("res" in auth) return auth.res;
  let input: CulturalSpot | undefined;
  try {
    input = await request.json();
  } catch {
    return jsonError(400, "Format permintaan tidak valid.");
  }
  const store = getLokawiraStore();
  const lat = Number(input?.coordinates?.lat);
  const lng = Number(input?.coordinates?.lng);
  if (!input || !String(input.name ?? "").trim() || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return jsonError(400, "Nama dan lokasi pin wajib diisi.");
  }
  const blocked = merchantBlocked(auth.user);
  if (blocked) return blocked;
  const vr = input.quest?.voucherReward;
  const disc = Number(vr?.discountAmount);
  const minS = Number(vr?.minimumSpend);
  if (!Number.isFinite(disc) || disc < 1000 || disc > 100000) return jsonError(400, "Nominal diskon harus Rp1.000 sampai Rp100.000.");
  if (!Number.isFinite(minS) || minS < 0 || minS > 10_000_000) return jsonError(400, "Minimal belanja tidak valid.");
  if (!String(input.quest?.targetObjectPrompt ?? "").trim()) return jsonError(400, "Tulis objek yang harus dipindai wisatawan.");
  if (auth.user.role === "MERCHANT" && input.spotType === "PRIMARY_DEST") {
    return jsonError(403, "Hanya pengelola yang boleh menambah cagar budaya utama.", "FORBIDDEN");
  }
  const newSpot: CulturalSpot = {
    ...input,
    id: `spot-${Date.now().toString(36)}`,
    ownerId: auth.user.role === "MERCHANT" ? auth.user.id : undefined,
    createdAt: new Date().toISOString(),
    // titik mitra nunggu review pengelola, titik pengelola langsung terbit
    status: auth.user.role === "MERCHANT" ? "PENDING_REVIEW" : "PUBLISHED",
    coordinates: { lat, lng },
  };
  newSpot.quest = { ...newSpot.quest, referenceImages: [] };
  store.spots.unshift(newSpot);
  return NextResponse.json({ spot: newSpot, spots: visibleSpots(auth.user) }, { status: 201 });
}
