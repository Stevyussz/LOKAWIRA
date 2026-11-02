"use client";

import { useLokawira } from "@/components/layout/LokawiraProvider";
import { CulturalVibe } from "@/types/lokawira";

// hex utk Lordicon & SVG, yg gak bisa meembaca CSS variable
export const VIBE_HEX: Record<
  CulturalVibe,
  { primary: string; umkm: string; accent: string }
> = {
  majapahit: { primary: "#C8421F", umkm: "#1F8A83", accent: "#F4B63F" },
  sogan: { primary: "#8C5A1B", umkm: "#44579A", accent: "#E8B44A" },
  bahari: { primary: "#0E7C74", umkm: "#D9622E", accent: "#FF9A62" },
  tridatu: { primary: "#C0173F", umkm: "#2F6F5E", accent: "#F2B84B" },
  ukiran: { primary: "#A15404", umkm: "#3F7A52", accent: "#F4B63F" },
};

export function useVibeHex() {
  const { activeVibe } = useLokawira();
  return VIBE_HEX[activeVibe] ?? VIBE_HEX.majapahit;
}
