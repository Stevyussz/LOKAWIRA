import { mockDisabled } from "@/lib/server/mockBackend";
import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { getLokawiraStore } from "@/lib/seedCulturalData";
import { awardXp, currentUser, getMock, jsonError, visibleSpots, wibDay } from "@/lib/server/mockBackend";
import { distanceMeters } from "@/lib/geo";
import { GEOFENCE_ON, geofenceCheck } from "@/lib/server/geofence";

// kecepatan antar-titik yg mustahil (m/s, ~144 km/j) dalam 10 menit terakhir
const MAX_SPEED_MS = 40;

/** Pengunjung chec-in di ttik. Server (bukan klien) yng menentukan XP dan menerbtkan kode kehadiran. */
export async function POST(request: NextRequest) {
  const off = mockDisabled();
  if (off) return off;
  let body: { spotId?: string; lat?: number; lng?: number; accuracyMeters?: number };
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Format permintaan tidak valid.");
  }
  const user = currentUser(request);
  // cuma titik yg emang keliatan buat dia (bkn yg menunggu review, diarsip, atau milik mitra nonaktif)
  const spot = visibleSpots(user).find((s) => s.id === body.spotId);
  if (!spot) return jsonError(404, "Titik lokasi tidak ditemukan.");

  const outside = geofenceCheck(body, spot, "check-in");
  if (outside) return outside;
  // satu check-in per titik per hari per akun, SELALU (dulu cuma pas geofence nyala, jadi XP & kode KDR bisa dipanen)
  if (user) {
    const mine = getMock().checkIns.filter((c) => c.userId === user.id);
    const today = wibDay();
    if (mine.some((c) => c.spotId === spot.id && wibDay(new Date(c.createdAt)) === today)) {
      return jsonError(409, "Kamu sudah check-in di titik ini hari ini.", "ALREADY_CHECKED_IN_TODAY");
    }
    // cek kecepatan mustahil butuh koordinat asli, jadi cuma pas geofence nyala
    if (GEOFENCE_ON) {
      const last = mine[0];
      const lastSpot = last && getLokawiraStore().spots.find((s) => s.id === last.spotId);
      const dt = last ? (Date.now() - new Date(last.createdAt).getTime()) / 1000 : Infinity;
      if (lastSpot && dt < 600 && distanceMeters(lastSpot.coordinates, spot.coordinates) / Math.max(dt, 1) > MAX_SPEED_MS) {
        return jsonError(403, "Perpindahan terlalu cepat dari check-in sebelumnya.", "IMPOSSIBLE_TRAVEL");
      }
    }
  }

  // kode unik: tabrakan bikin hadiah misi masuk ke orang lain
  const all = getMock().checkIns;
  let code = "";
  do code = `KDR-${crypto.randomInt(100000, 999999)}`;
  while (all.some((c) => c.code === code));
  const checkIn = {
    id: `ci-${crypto.randomBytes(4).toString("hex")}`,
    code,
    spotId: spot.id,
    userId: user?.id ?? null,
    createdAt: new Date().toISOString(),
    verified: false,
  };
  getMock().checkIns.unshift(checkIn);
  // tamu: kode kehadiran tetep terbit, tapi XP gak ada akun buat dicatat
  const points = user ? 50 : 0;
  awardXp(user?.id, points);
  return NextResponse.json({
    checkIn: { id: checkIn.id, code, spotId: spot.id, createdAt: checkIn.createdAt },
    awardedPoints: points,
  });
}
