import type { IconName } from "@/components/ui/Icon";
import type { CulturalSpot, CulturalVibe, SpotType } from "@/types/lokawira";

// Metadata tampilan titik & palet peta per kawasan (sinkron dengan [data-vibe] di globals.css)
export const SPOT_TYPE_LABEL: Record<SpotType, string> = {
  PRIMARY_DEST: "Cagar budaya",
  SANGGAR_SENI: "Sanggar seni",
  UMKM_KULINER: "Makan & minum",
  UMKM_KRIYA: "Kriya & oleh-oleh",
};

export const SPOT_TYPE_ICON: Record<SpotType, IconName> = {
  PRIMARY_DEST: "heritage",
  SANGGAR_SENI: "sanggar",
  UMKM_KULINER: "food",
  UMKM_KRIYA: "umkm",
};

export function spotTypeIcon(type: SpotType): IconName {
  return SPOT_TYPE_ICON[type];
}

export function spotTypeLabel(type: SpotType): string {
  return SPOT_TYPE_LABEL[type];
}

export const REGION_COVER_IMAGE: Record<CulturalVibe, string> = {
  majapahit: "/images/cover-majapahit.webp",
  sogan: "/images/cover-sogan.webp",
  bahari: "/images/cover-bahari.webp",
  tridatu: "/images/cover-tridatu.webp",
  ukiran: "/images/cover-ukiran.webp",
};

export const FEATURE_COVER_IMAGE = {
  kuliner: "/images/cover-kuliner.webp",
  kriya: "/images/cover-kriya.webp",
  sanggar: "/images/cover-sanggar.webp",
  tas: "/images/cover-tas.webp",
  kisah: "/images/cover-kisah.webp",
  jelajah: "/images/cover-jelajah.webp",
} as const;

export function spotCoverImage(spot: Pick<CulturalSpot, "spotType" | "vibe">): string {
  switch (spot.spotType) {
    case "SANGGAR_SENI":
      return FEATURE_COVER_IMAGE.sanggar;
    case "UMKM_KULINER":
      return FEATURE_COVER_IMAGE.kuliner;
    case "UMKM_KRIYA":
      return FEATURE_COVER_IMAGE.kriya;
    default:
      return REGION_COVER_IMAGE[spot.vibe] ?? REGION_COVER_IMAGE.majapahit;
  }
}

export interface VibeMapPalette {
  land: string;
  block: string;
  park: string;
  water: string;
  waterDeep: string;
  road: string;
  roadEdge: string;
  minor: string;
  text: string;
  halo: string;
  primary: string;
  umkm: string;
  accent: string;
  safe: string;
}

export const VIBE_MAP_PALETTE: Record<CulturalVibe, VibeMapPalette> = {
  majapahit: {
    land: "#F3E4CA",
    block: "#E7CFA6",
    park: "#C9DBA8",
    water: "#AFD2D0",
    waterDeep: "#92C0C2",
    road: "#FFF8E8",
    roadEdge: "#D6BC8F",
    minor: "#F9F0DF",
    text: "#574E63",
    halo: "#FFF8E8",
    primary: "#C8421F",
    umkm: "#1F8A83",
    accent: "#F4B63F",
    safe: "#1B6334",
  },
  sogan: {
    land: "#EDDFC6",
    block: "#DAC29B",
    park: "#C6D4A6",
    water: "#A4BDD6",
    waterDeep: "#8AA8C8",
    road: "#FBF3E2",
    roadEdge: "#CBB285",
    minor: "#F4EBD7",
    text: "#574E63",
    halo: "#FBF3E2",
    primary: "#8C5A1B",
    umkm: "#44579A",
    accent: "#E8B44A",
    safe: "#1B6334",
  },
  bahari: {
    land: "#F1EAD6",
    block: "#DFD8BE",
    park: "#B9DFC2",
    water: "#86CFDD",
    waterDeep: "#63BACD",
    road: "#FFFCF2",
    roadEdge: "#D3CAAA",
    minor: "#F7F3E3",
    text: "#574E63",
    halo: "#FFFCF2",
    primary: "#0E7C74",
    umkm: "#D9622E",
    accent: "#FF9A62",
    safe: "#1B6334",
  },
  tridatu: {
    land: "#F4E6DD",
    block: "#EAD0C4",
    park: "#C5DBB0",
    water: "#ADD0D9",
    waterDeep: "#90BEC9",
    road: "#FFF6F0",
    roadEdge: "#DBB8AB",
    minor: "#FAF0E9",
    text: "#574E63",
    halo: "#FFF6F0",
    primary: "#C0173F",
    umkm: "#2F6F5E",
    accent: "#F2B84B",
    safe: "#1B6334",
  },
  ukiran: {
    land: "#EFDFBE",
    block: "#E0C493",
    park: "#C2D19B",
    water: "#A3C5BD",
    waterDeep: "#86B0A8",
    road: "#FFF5DC",
    roadEdge: "#D1B176",
    minor: "#F8ECD0",
    text: "#574E63",
    halo: "#FFF5DC",
    primary: "#A15404",
    umkm: "#3F7A52",
    accent: "#F4B63F",
    safe: "#1B6334",
  },
};
