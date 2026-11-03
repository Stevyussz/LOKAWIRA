import { NextResponse } from "next/server";
import { distanceMeters } from "@/lib/geo";
import { jsonError } from "@/lib/server/mockBackend";

// geofence nyala kalo GEOFENCE_ENABLED=true (env server, default mati biar demo juri aman). Radius & batas akurasi bisa diatur
export const GEOFENCE_ON = process.env.GEOFENCE_ENABLED === "true";
export const RADIUS_M = Number(process.env.GEOFENCE_RADIUS_METERS) || 100;
export const MAX_ACCURACY_M = 100;

interface Where {
  lat?: unknown;
  lng?: unknown;
  accuracyMeters?: unknown;
}

// dipake check-in & scan: balikin respons galat kalo lokasinya gak lolos, null kalo lolos (atau geofence mati).
// Koordinat mentah pengguna sengaja TIDAK disimpan, cuma hasil pemeriksaannya
export function geofenceCheck(where: Where, spot: { coordinates: { lat: number; lng: number } }, what: string): NextResponse | null {
  if (!GEOFENCE_ON) return null;
  const empty = (v: unknown) => v == null || v === "";
  if (empty(where.lat) || empty(where.lng)) return jsonError(400, `Lokasi dibutuhkan untuk ${what} di titik ini.`, "LOCATION_REQUIRED");
  const lat = Number(where.lat);
  const lng = Number(where.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return jsonError(400, "Koordinat tidak valid.", "LOCATION_REQUIRED");
  }
  if (!(Number(where.accuracyMeters) <= MAX_ACCURACY_M)) {
    return jsonError(400, "Sinyal GPS kurang tepat. Pindah ke area terbuka.", "LOCATION_TOO_INACCURATE");
  }
  const dist = distanceMeters({ lat, lng }, spot.coordinates);
  if (dist > RADIUS_M) {
    return NextResponse.json(
      { error: "Kamu belum cukup dekat dengan titik ini.", code: "OUT_OF_RANGE", details: { distanceMeters: Math.round(dist), radiusMeters: RADIUS_M } },
      { status: 403 }
    );
  }
  return null;
}
