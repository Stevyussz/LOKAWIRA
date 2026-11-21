import type { LatLng } from "@/lib/geo";

export type TravelMode = "foot" | "motorcycle";

// Rute nyata dr layanan routing berbasis OpenStreetMap (OSRM).
// Produksi sebaiknya memakai backend sendiri agar tidak bergantung batas layanan publik.
const FOOT_BASE = (process.env.NEXT_PUBLIC_ROUTING_URL ?? "https://routing.openstreetmap.de/routed-foot").replace(/\/$/, "");
const CAR_BASE = (process.env.NEXT_PUBLIC_CAR_ROUTING_URL ?? "https://routing.openstreetmap.de/routed-car").replace(/\/$/, "");

export interface WalkingRoute {
  coords: [number, number][];
  meters: number;
  seconds: number;
}

export async function fetchMultiStopRoute(waypoints: LatLng[], mode: TravelMode = "foot"): Promise<WalkingRoute | null> {
  if (waypoints.length < 2) return null;
  const base = mode === "motorcycle" ? CAR_BASE : FOOT_BASE;
  const profile = mode === "motorcycle" ? "driving" : "foot";
  const coordsParam = waypoints.map((w) => `${w.lng},${w.lat}`).join(";");
  const url = `${base}/route/v1/${profile}/${coordsParam}?overview=full&geometries=geojson`;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const res = await fetch(url, { signal: ctl.signal });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      code?: string;
      routes?: { geometry: { coordinates: [number, number][] }; distance: number; duration: number }[];
    };
    const r = data.code === "Ok" ? data.routes?.[0] : undefined;
    if (!r || r.geometry.coordinates.length < 2) return null;
    // Kecepatan motor kota wisata ~26 km/jam (~7.2 m/dtk) dibanding profil mobil tol
    const seconds = mode === "motorcycle" ? Math.max(r.duration, Math.round(r.distance / 7.2)) : r.duration;
    return { coords: r.geometry.coordinates, meters: r.distance, seconds };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchRoute(from: LatLng, to: LatLng, mode: TravelMode = "foot"): Promise<WalkingRoute | null> {
  return fetchMultiStopRoute([from, to], mode);
}

export async function fetchWalkingRoute(from: LatLng, to: LatLng): Promise<WalkingRoute | null> {
  return fetchRoute(from, to, "foot");
}
