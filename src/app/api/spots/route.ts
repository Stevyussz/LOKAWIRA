import { mockDisabled } from "@/lib/server/mockBackend";
import { NextRequest, NextResponse } from "next/server";
import { getLokawiraStore } from "@/lib/seedCulturalData";
import { CulturalSpot, CulturalVibe } from "@/types/lokawira";
import { currentUser, jsonError, merchantBlocked, ownsSpot, requireRole, visibleSpots } from "@/lib/server/mockBackend";

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

  return NextResponse.json({
    spots,
    vouchers: isMerchant ? store.vouchers.filter((v) => mine.has(v.spotId)) : store.vouchers,
    reservations: isMerchant ? [] : store.reservations,
    aiTrainingNotes: store.aiTrainingNotes,
  });
}

export async function POST(request: NextRequest) {
  const off = mockDisabled();
  if (off) return off;
  try {
    const body = await request.json();
    const store = getLokawiraStore();

    if (body.action === "UPDATE_QUOTA") {
      const auth = requireRole(request, ["ADMIN"]);
      if ("res" in auth) return auth.res;
      const { spotId, currentVisitors } = body;
      const target = store.spots.find((s) => s.id === spotId);
      if (!target) {
        return NextResponse.json({ error: "Titik lokasi tidak ditemukan" }, { status: 404 });
      }
      target.quota.currentVisitors = Math.max(0, Math.min(target.quota.maxCapacity, Number(currentVisitors)));
      const ratio = target.quota.currentVisitors / target.quota.maxCapacity;
      target.quota.estimatedWaitMinutes = ratio >= 0.85 ? 35 : ratio >= 0.6 ? 15 : 0;
      return NextResponse.json({ spot: target, spots: visibleSpots(auth.user) });
    }

    if (body.action === "ADD_SPOT") {
      const auth = requireRole(request, ["MERCHANT", "ADMIN"]);
      if ("res" in auth) return auth.res;
      const input = body.spot as CulturalSpot | undefined;
      const lat = Number(input?.coordinates?.lat);
      const lng = Number(input?.coordinates?.lng);
      if (!input || !String(input.name ?? "").trim() || !Number.isFinite(lat) || !Number.isFinite(lng)) {
        return jsonError(400, "Nama dan lokasi pin wajib diisi.");
      }
      const blocked = merchantBlocked(auth.user);
      if (blocked) return blocked;
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
      store.spots.unshift(newSpot);
      return NextResponse.json({ spot: newSpot, spots: visibleSpots(auth.user) });
    }

    if (body.action === "UPDATE_PROMO") {
      const auth = requireRole(request, ["MERCHANT", "ADMIN"]);
      if ("res" in auth) return auth.res;
      const blockedPromo = merchantBlocked(auth.user);
      if (blockedPromo) return blockedPromo;
      const target = store.spots.find((s) => s.id === body.spotId);
      if (!target) return jsonError(404, "Titik lokasi tidak ditemukan.");
      if (!ownsSpot(auth.user, target.id)) return jsonError(403, "Ini bukan lapak Anda.", "NOT_YOUR_SPOT");
      const amount = Number(body.discountAmount);
      const minSpend = Number(body.minimumSpend);
      const title = String(body.discountTitle ?? "").trim();
      if (!title) return jsonError(400, "Judul promo wajib diisi.");
      if (!Number.isFinite(amount) || amount < 1000 || amount > 100000) return jsonError(400, "Nominal diskon harus Rp1.000 sampai Rp100.000.");
      if (!Number.isFinite(minSpend) || minSpend < 0) return jsonError(400, "Minimal belanja tidak valid.");
      target.quest.voucherReward = { ...target.quest.voucherReward, discountTitle: title, discountAmount: amount, minimumSpend: minSpend };
      // Hany penglola yg bole mengubah XP misi (ekonomi gamifikasi).
      if (auth.user.role === "ADMIN" && Number.isFinite(Number(body.rewardPoints))) {
        target.quest.rewardPoints = Math.max(0, Math.min(1000, Number(body.rewardPoints)));
      }
      return NextResponse.json({ spot: target, spots: visibleSpots(auth.user) });
    }

    if (body.action === "ADD_AI_NOTE") {
      const auth = requireRole(request, ["ADMIN"]);
      if ("res" in auth) return auth.res;
      const note = {
        id: `rag-${Date.now().toString().slice(-4)}`,
        opkCategory: body.opkCategory,
        maestroSource: body.maestroSource,
        summary: body.summary,
        updatedAt: "Baru saja disinkronkan",
      };
      store.aiTrainingNotes.unshift(note);
      return NextResponse.json({ aiTrainingNotes: store.aiTrainingNotes });
    }

    return NextResponse.json({ error: "Aksi tidak dikenali" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Format permintaan tidak valid" }, { status: 400 });
  }
}
