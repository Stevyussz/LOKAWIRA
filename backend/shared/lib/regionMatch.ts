import { distanceMeters } from "@/lib/geo";
import type { Region } from "@/types/lokawira";

// kawasan terdekat yg radiusnya mencakup titik ini (dipake server & form, biar hasilnya sama).
// Kawasan DRAFT ikut dihitung: pengelola bisa nyiapin titik dulu sebelum kawasannya diaktifkan
// (titiknya tetap tersembunyi dr wisatawan selama kawasannya draf)
export function matchRegion(c: { lat: number; lng: number }, regions: Region[]): Region | null {
  let best: { r: Region; d: number } | null = null;
  for (const r of regions) {
    const d = distanceMeters(c, r.center);
    if (d <= r.radiusKm * 1000 && (!best || d < best.d)) best = { r, d };
  }
  return best?.r ?? null;
}
