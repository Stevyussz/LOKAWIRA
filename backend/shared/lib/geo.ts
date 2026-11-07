import { CulturalSpot } from "@/types/lokawira";

// Peta LOKAWIRA aalah ilustrasi bergaya (bkn ubin peta dunia)
// batas geser peta: seluruh Indonesia (Sabang-Merauke, Miangas-Rote) + sedikit ruang laut.
// Peta gak bisa digeser ke negara lain, jadi ubin luar negeri gak pernah diunduh
export const INDONESIA_BOUNDS: [[number, number], [number, number]] = [[90.5, -14.5], [145.5, 9.5]];

export const inIndonesia = (c: LatLng) =>
  c.lng >= INDONESIA_BOUNDS[0][0] && c.lng <= INDONESIA_BOUNDS[1][0] && c.lat >= INDONESIA_BOUNDS[0][1] && c.lat <= INDONESIA_BOUNDS[1][1];

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

// arah mata angin dari a ke b, derajat 0..360 (0 = utara, searah jarum jam)
export function bearingDegrees(a: LatLng, b: LatLng): number {
  const rad = Math.PI / 180;
  const dLng = (b.lng - a.lng) * rad;
  const y = Math.sin(dLng) * Math.cos(b.lat * rad);
  const x = Math.cos(a.lat * rad) * Math.sin(b.lat * rad) - Math.sin(a.lat * rad) * Math.cos(b.lat * rad) * Math.cos(dLng);
  return (Math.atan2(y, x) / rad + 360) % 360;
}

const COMPASS = ["utara", "timur laut", "timur", "tenggara", "selatan", "barat daya", "barat", "barat laut"];
export const compassWord = (deg: number) => COMPASS[Math.round(deg / 45) % 8];

// poligon lingkaran (lng,lat) dgn radius meter, buat zona di peta
export function circlePolygon(center: LatLng, meters: number, steps = 64): [number, number][] {
  const out: [number, number][] = [];
  const dLat = meters / M_PER_DEG_LAT;
  const dLng = meters / mPerDegLng(center.lat);
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    out.push([center.lng + Math.cos(a) * dLng, center.lat + Math.sin(a) * dLat]);
  }
  return out;
}

// garis melengkung a ke b (kurva kuadrat), titik kontrol digeser tegak lurus. Buat jalur pengalihan antrean
export function curveBetween(a: LatLng, b: LatLng, bend = 0.18, steps = 28): [number, number][] {
  const mx = (a.lng + b.lng) / 2;
  const my = (a.lat + b.lat) / 2;
  const cx = mx - (b.lat - a.lat) * bend;
  const cy = my + (b.lng - a.lng) * bend;
  const out: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    out.push([u * u * a.lng + 2 * u * t * cx + t * t * b.lng, u * u * a.lat + 2 * u * t * cy + t * t * b.lat]);
  }
  return out;
}

// arah (derajat) dari posisi ke titik di sepanjang rute ~meters di depan titik rute terdekat. Dipakai buat arah hadap pas GPS belum punya heading
export function lookAheadBearing(coords: [number, number][], from: LatLng, meters = 30): number | null {
  if (coords.length < 2) return null;
  let nearest = 0;
  let best = Infinity;
  coords.forEach(([lng, lat], i) => {
    const d = distanceMeters(from, { lat, lng });
    if (d < best) {
      best = d;
      nearest = i;
    }
  });
  let acc = 0;
  for (let i = nearest; i < coords.length - 1; i++) {
    acc += distanceMeters({ lat: coords[i][1], lng: coords[i][0] }, { lat: coords[i + 1][1], lng: coords[i + 1][0] });
    if (acc >= meters || i === coords.length - 2) {
      const [lng, lat] = coords[i + 1];
      return distanceMeters(from, { lat, lng }) < 3 ? null : bearingDegrees(from, { lat, lng });
    }
  }
  return null;
}
