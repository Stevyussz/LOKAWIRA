import { matchRegion } from "@/lib/regionMatch";
import { getLokawiraStore } from "@/lib/seedCulturalData";
import type { CulturalSpot, Region } from "@/types/lokawira";

// kawasan aktif terdekat yg radiusnya mencakup titik ini. null = di luar semua kawasan
export function regionFor(c: { lat: number; lng: number }, regions = getLokawiraStore().regions): Region | null {
  return matchRegion(c, regions);
}

// pasang kawasan ke titik (dr koordinatnya): regionId, palet, & nama kawasan ikut kawasan
export function applyRegion(spot: CulturalSpot, region: Region | null) {
  if (region) {
    spot.regionId = region.id;
    spot.vibe = region.theme;
    spot.regionName = `${region.name}, ${region.label}`;
    delete spot.regionProposal;
  } else {
    delete spot.regionId;
  }
}

// kawasan baru/diubah: titik yatim (di luar kawasan) yg sekarang masuk radius langsung ikut. Balikin jumlahnya
export function adoptOrphans(): number {
  const store = getLokawiraStore();
  let n = 0;
  for (const s of store.spots) {
    if (s.regionId || s.status === "ARCHIVED") continue;
    const r = regionFor(s.coordinates, store.regions);
    if (r) {
      applyRegion(s, r);
      n++;
    }
  }
  return n;
}

// kawasan yg boleh dilihat: publik cuma ACTIVE, pengelola semua
export function visibleRegions(isAdmin: boolean): Region[] {
  const all = getLokawiraStore().regions;
  return isAdmin ? all : all.filter((r) => r.status === "ACTIVE");
}
