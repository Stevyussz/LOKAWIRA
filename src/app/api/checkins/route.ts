import { mockDisabled } from "@/lib/server/mockBackend";
import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { getLokawiraStore } from "@/lib/seedCulturalData";
import { awardXp, currentUser, getMock, jsonError } from "@/lib/server/mockBackend";
import { distanceMeters } from "@/lib/geo";

// geofence nyala kalo GEOFENCE_ENABLED=true (env server, default mati biar demo juri aman). Radius & batas akurasi bisa diatur
const GEOFENCE_ON = process.env.GEOFENCE_ENABLED === "true";
const RADIUS_M = Number(process.env.GEOFENCE_RADIUS_METERS) || 100;
const MAX_ACCURACY_M = 100;
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
  const spot = getLokawiraStore().spots.find((s) => s.id === body.spotId);
  if (!spot) return jsonError(404, "Titik lokasi tidak ditemukan.");

  const user = currentUser(request);
  if (GEOFENCE_ON) {
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    if (body.lat == null || body.lng == null) return jsonError(400, "Lokasi dibutuhkan untuk check-in di titik ini.", "LOCATION_REQUIRED");
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return jsonError(400, "Koordinat tidak valid.", "LOCATION_REQUIRED");
    }
    if (!(Number(body.accuracyMeters) <= MAX_ACCURACY_M)) {
      return jsonError(400, "Sinyal GPS kurang tepat. Pindah ke area terbuka.", "LOCATION_TOO_INACCURATE");
    }
    const dist = distanceMeters({ lat, lng }, spot.coordinates);
    // koordinat mentah pengguna sengaja TIDAK disimpan, cuma hasil pemeriksaannya
    if (dist > RADIUS_M) {
      return NextResponse.json(
        { error: "Kamu belum cukup dekat dengan titik ini.", code: "OUT_OF_RANGE", details: { distanceMeters: Math.round(dist), radiusMeters: RADIUS_M } },
        { status: 403 }
      );
    }
    if (user) {
      const mine = getMock().checkIns.filter((c) => c.userId === user.id);
      const today = new Date().toDateString();
      if (mine.some((c) => c.spotId === spot.id && new Date(c.createdAt).toDateString() === today)) {
        return jsonError(409, "Kamu sudah check-in di titik ini hari ini.", "ALREADY_CHECKED_IN_TODAY");
      }
      const last = mine[0];
      const lastSpot = last && getLokawiraStore().spots.find((s) => s.id === last.spotId);
      const dt = last ? (Date.now() - new Date(last.createdAt).getTime()) / 1000 : Infinity;
      if (lastSpot && dt < 600 && distanceMeters(lastSpot.coordinates, spot.coordinates) / Math.max(dt, 1) > MAX_SPEED_MS) {
        return jsonError(403, "Perpindahan terlalu cepat dari check-in sebelumnya.", "IMPOSSIBLE_TRAVEL");
      }
    }
  }

  const code = `KDR-${crypto.randomInt(100000, 999999)}`;
  const checkIn = {
    id: `ci-${crypto.randomBytes(4).toString("hex")}`,
    code,
    spotId: spot.id,
    userId: user?.id ?? null,
    createdAt: new Date().toISOString(),
    verified: false,
  };
  getMock().checkIns.unshift(checkIn);
  awardXp(user?.id, 50);
  return NextResponse.json({
    checkIn: { id: checkIn.id, code, spotId: spot.id, createdAt: checkIn.createdAt },
    awardedPoints: 50,
  });
}
