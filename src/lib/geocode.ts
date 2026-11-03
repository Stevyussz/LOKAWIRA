import type { LatLng } from "@/lib/geo";

// cari alamat/nama tempat (data OpenStreetMap lewat Nominatim). Gratis tapi cuma buat pemakaian ringan:
// dipicu tombol Cari (bkn tiap ketikan) dan maks 1 permintaan/dtk. Produksi: sebaiknya lewat backend sendiri
const GEOCODE_BASE = (process.env.NEXT_PUBLIC_GEOCODE_URL ?? "https://nominatim.openstreetmap.org").replace(/\/$/, "");

export interface PlaceResult {
  name: string;
  detail: string;
  coords: LatLng;
}

export async function searchPlaces(query: string, near?: LatLng): Promise<PlaceResult[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const params = new URLSearchParams({ q, format: "jsonv2", limit: "6", countrycodes: "id", addressdetails: "0", "accept-language": "id" });
  if (near) {
    // condongkan hasil ke sekitar kawasan terpilih (~25 km), tapi tetap boleh di luar
    const d = 0.25;
    params.set("viewbox", `${near.lng - d},${near.lat + d},${near.lng + d},${near.lat - d}`);
  }
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const res = await fetch(`${GEOCODE_BASE}/search?${params}`, { signal: ctl.signal });
    if (!res.ok) throw new Error(`geocode ${res.status}`);
    const rows = (await res.json()) as { display_name: string; name?: string; lat: string; lon: string }[];
    return rows
      .map((r) => {
        const parts = r.display_name.split(",").map((x) => x.trim());
        return {
          name: r.name || parts[0],
          detail: parts.slice(1, 4).join(", "),
          coords: { lat: Number(r.lat), lng: Number(r.lon) },
        };
      })
      .filter((r) => Number.isFinite(r.coords.lat) && Number.isFinite(r.coords.lng));
  } finally {
    clearTimeout(timer);
  }
}
