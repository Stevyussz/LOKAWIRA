import type { LatLng } from "@/lib/geo";

// rute jalan kaki nyata dr layanan routing berbasis OpenStreetMap (OSM Germany, gratis tapi cuma buat pemakaian ringan).
// Produksi: sebaiknya lewat backend sendiri (OSRM/Valhalla di VPS) biar gak bergantung layanan publik.
const ROUTING_BASE = (process.env.NEXT_PUBLIC_ROUTING_URL ?? "https://routing.openstreetmap.de/routed-foot").replace(/\/$/, "");

export interface WalkingRoute {
  coords: [number, number][];
  meters: number;
  seconds: number;
}

export async function fetchWalkingRoute(from: LatLng, to: LatLng): Promise<WalkingRoute | null> {
  const url = `${ROUTING_BASE}/route/v1/foot/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const res = await fetch(url, { signal: ctl.signal });
    if (!res.ok) return null;
    const data = (await res.json()) as { code?: string; routes?: { geometry: { coordinates: [number, number][] }; distance: number; duration: number }[] };
    const r = data.code === "Ok" ? data.routes?.[0] : undefined;
    if (!r || r.geometry.coordinates.length < 2) return null;
    return { coords: r.geometry.coordinates, meters: r.distance, seconds: r.duration };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
