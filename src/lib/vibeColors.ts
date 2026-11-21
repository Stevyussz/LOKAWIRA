"use client";

import { useLokawira } from "@/components/layout/LokawiraProvider";
import { VIBE_MAP_PALETTE } from "@/lib/spotMeta";
import { CulturalVibe } from "@/types/lokawira";

// hex untuk SVG & WebGL yang tidak membaca CSS variable
export const VIBE_HEX: Record<
  CulturalVibe,
  { primary: string; umkm: string; accent: string }
> = {
  majapahit: { primary: VIBE_MAP_PALETTE.majapahit.primary, umkm: VIBE_MAP_PALETTE.majapahit.umkm, accent: VIBE_MAP_PALETTE.majapahit.accent },
  sogan: { primary: VIBE_MAP_PALETTE.sogan.primary, umkm: VIBE_MAP_PALETTE.sogan.umkm, accent: VIBE_MAP_PALETTE.sogan.accent },
  bahari: { primary: VIBE_MAP_PALETTE.bahari.primary, umkm: VIBE_MAP_PALETTE.bahari.umkm, accent: VIBE_MAP_PALETTE.bahari.accent },
  tridatu: { primary: VIBE_MAP_PALETTE.tridatu.primary, umkm: VIBE_MAP_PALETTE.tridatu.umkm, accent: VIBE_MAP_PALETTE.tridatu.accent },
  ukiran: { primary: VIBE_MAP_PALETTE.ukiran.primary, umkm: VIBE_MAP_PALETTE.ukiran.umkm, accent: VIBE_MAP_PALETTE.ukiran.accent },
};

export function useVibeHex() {
  const { activeVibe } = useLokawira();
  return VIBE_HEX[activeVibe] ?? VIBE_HEX.majapahit;
}
