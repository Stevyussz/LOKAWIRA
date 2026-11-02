import { CulturalSpot } from "@/types/lokawira";

// Peta LOKAWIRA aalah ilustrasi bergaya (bkn ubin peta dunia)
export const CANVAS_W = 2400;
export const CANVAS_H = 1600;
export const ORIGIN_ON_CANVAS = { x: 1180, y: 740 };
export const UNITS_PER_METER = 390 / 250;
export const ZONE_RADIUS_UNITS = 390;
export const ZONE_RADIUS_METERS = 250;

const M_PER_DEG_LAT = 111_320;
const mPerDegLng = (lat: number) => 111_320 * Math.cos((lat * Math.PI) / 180);

export interface LatLng {
  lat: number;
  lng: number;
}
export interface Point {
  x: number;
  y: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// cagar utama yg menjadi jangkar kawasan: yg tertua (createdAt kosong dinaggap paling tua)
export function anchorSpot(spots: CulturalSpot[]): CulturalSpot | null {
  const primaries = spots.filter((s) => s.spotType === "PRIMARY_DEST");
  if (primaries.length === 0) return null;
  return [...primaries].sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""))[0];
}

// titik acuan proyeksi: jangar kawasan kalo ada, kalo gak titik pertama
export function regionOrigin(spots: CulturalSpot[]): CulturalSpot | null {
  return anchorSpot(spots) ?? spots[0] ?? null;
}

export function project(c: LatLng, origin: LatLng): Point {
  const dx = (c.lng - origin.lng) * mPerDegLng(origin.lat);
  const dy = (origin.lat - c.lat) * M_PER_DEG_LAT; // utara ke atas
  return {
    x: clamp(ORIGIN_ON_CANVAS.x + dx * UNITS_PER_METER, 160, CANVAS_W - 160),
    y: clamp(ORIGIN_ON_CANVAS.y + dy * UNITS_PER_METER, 160, CANVAS_H - 160),
  };
}

export function unproject(p: Point, origin: LatLng): LatLng {
  const dxM = (p.x - ORIGIN_ON_CANVAS.x) / UNITS_PER_METER;
  const dyM = (p.y - ORIGIN_ON_CANVAS.y) / UNITS_PER_METER;
  return {
    lat: origin.lat - dyM / M_PER_DEG_LAT,
    lng: origin.lng + dxM / mPerDegLng(origin.lat),
  };
}

// Jarak garis lurus (Haversine) dlm meter
export function distanceMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export const formatDistance = (m: number) =>
  m < 1000 ? `${Math.max(10, Math.round(m / 10) * 10)} m` : `${(m / 1000).toFixed(1).replace(".", ",")} km`;

export const formatCoord = (c: LatLng) => `${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}`;
