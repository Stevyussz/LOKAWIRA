import { CulturalSpot } from "@/types/lokawira";

export type SpotFilter = "ALL" | "PRIMARY_DEST" | "SANGGAR_SENI" | "KULINER" | "KRIYA";

export const SPOT_FILTER_OPTIONS: { id: SpotFilter; label: string }[] = [
  { id: "ALL", label: "Semua" },
  { id: "PRIMARY_DEST", label: "Cagar Budaya" },
  { id: "SANGGAR_SENI", label: "Sanggar Seni" },
  { id: "KULINER", label: "Makan & Minum" },
  { id: "KRIYA", label: "Oleh-oleh" },
];

// satu sumber aturan filter, dipakai peta, kartu lokasi, & chip biar gak saling bertentanagn
export function matchesSpotFilter(spot: CulturalSpot, filter: SpotFilter): boolean {
  if (filter === "ALL") return true;
  if (filter === "KULINER") return spot.spotType === "UMKM_KULINER";
  if (filter === "KRIYA") return spot.spotType === "UMKM_KRIYA";
  return spot.spotType === filter;
}
