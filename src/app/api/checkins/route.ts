import { mockDisabled } from "@/lib/server/mockBackend";
import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { getLokawiraStore } from "@/lib/seedCulturalData";
import { currentUser, getMock, jsonError } from "@/lib/server/mockBackend";

/** Pengunjung chec-in di ttik. Server (bukan klien) yng menentukan XP dan menerbtkan kode kehadiran. */
export async function POST(request: NextRequest) {
  const off = mockDisabled();
  if (off) return off;
  let body: { spotId?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Format permintaan tidak valid.");
  }
  const spot = getLokawiraStore().spots.find((s) => s.id === body.spotId);
  if (!spot) return jsonError(404, "Titik lokasi tidak ditemukan.");

  const code = `KDR-${crypto.randomInt(100000, 999999)}`;
  const checkIn = {
    id: `ci-${crypto.randomBytes(4).toString("hex")}`,
    code,
    spotId: spot.id,
    userId: currentUser(request)?.id ?? null,
    createdAt: new Date().toISOString(),
    verified: false,
  };
  getMock().checkIns.unshift(checkIn);
  return NextResponse.json({
    checkIn: { id: checkIn.id, code, spotId: spot.id, createdAt: checkIn.createdAt },
    awardedPoints: 50,
  });
}
