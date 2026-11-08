import type { CulturalSpot } from "@/types/lokawira";
import { keywords } from "@/lib/loka";

export interface LoreNote {
  id: string;
  opkCategory: string;
  maestroSource: string;
  summary: string;
}

// pilih rujukan Pengetahuan Loka yg paling nyambung sama titik & pertanyaan (pencocokan kata dasar).
// Kata dr pertanyaan bobotnya lebih besar dr kata nama titik. OPK sama dapat nilai tambah. Maks 3 biar prompt pendek
export function pickNotes(spot: CulturalSpot, notes: LoreNote[], question?: string, max = 3): LoreNote[] {
  const spotWords = new Set([...keywords(spot.name), ...keywords(spot.regionName ?? ""), ...keywords(spot.quest.targetObjectPrompt ?? "")]);
  const qWords = new Set(keywords(question ?? ""));
  return notes
    .map((n) => {
      const hay = new Set(keywords(`${n.summary} ${n.maestroSource}`));
      let score = 0;
      spotWords.forEach((w) => {
        if (hay.has(w)) score += 2;
      });
      qWords.forEach((w) => {
        if (hay.has(w)) score += 3;
      });
      if (n.opkCategory === spot.opkCategory) score += 1;
      return { n, score };
    })
    .filter((x) => x.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map((x) => x.n);
}

// konteks budaya yg dikirim ke model: satu2nya sumber fakta budaya yg boleh dipakai
export function buildContext(spot: CulturalSpot, notes: LoreNote[]): string {
  const lines = [`[R0] Narasi terkurasi titik "${spot.name}" (sumber: ${spot.quest.verifiedLoreSource}): ${spot.quest.loreNarrative}`];
  notes.forEach((n, i) => lines.push(`[R${i + 1}] ${n.opkCategory}, sumber: ${n.maestroSource}: ${n.summary}`));
  return lines.join("\n");
}
