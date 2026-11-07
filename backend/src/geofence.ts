import { distanceMeters } from "@/lib/geo";
import { fail } from "./core.js";

// GEOFENCE_ENABLED=true: check-in & scan wajib di dekat titik. Koordinat mentah gak disimpan, cuma hasil ceknya
export const GEOFENCE_ON = process.env.GEOFENCE_ENABLED === "true";
export const RADIUS_M = Number(process.env.GEOFENCE_RADIUS_METERS) || 100;
const MAX_ACCURACY_M = 100;

export function geofence(where: { lat?: unknown; lng?: unknown; accuracyMeters?: unknown }, spot: { coordinates: { lat: number; lng: number } }, what: string) {
  if (!GEOFENCE_ON) return;
  const empty = (v: unknown) => v == null || v === "";
  if (empty(where.lat) || empty(where.lng)) fail(400, `Lokasi dibutuhkan untuk ${what} di titik ini.`, "LOCATION_REQUIRED");
  const lat = Number(where.lat);
  const lng = Number(where.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) fail(400, "Koordinat tidak valid.", "LOCATION_REQUIRED");
  if (!(Number(where.accuracyMeters) <= MAX_ACCURACY_M)) fail(400, "Sinyal GPS kurang tepat. Pindah ke area terbuka.", "LOCATION_TOO_INACCURATE");
  const dist = distanceMeters({ lat, lng }, spot.coordinates);
  if (dist > RADIUS_M) fail(403, "Kamu belum cukup dekat dengan titik ini.", "OUT_OF_RANGE", { distanceMeters: Math.round(dist), radiusMeters: RADIUS_M });
}
