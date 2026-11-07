// daftar nilai sah buat validasi server (harus sama dgn union di types/lokawira.ts)
import type { CulturalVibe, OpkCategory, SpotType } from "@/types/lokawira";

export const SPOT_TYPES: SpotType[] = ["PRIMARY_DEST", "SANGGAR_SENI", "UMKM_KULINER", "UMKM_KRIYA"];
export const VIBES: CulturalVibe[] = ["majapahit", "sogan", "bahari", "tridatu", "ukiran"];
export const OPK_VALUES: OpkCategory[] = [
  "Tradisi Lisan", "Manuskrip", "Adat Istiadat", "Ritus", "Pengetahuan Tradisional", "Teknologi Tradisional",
  "Seni", "Bahasa", "Permainan Rakyat", "Olahraga Tradisional", "Cagar Budaya",
];
