import type { CulturalSpot } from "@/types/lokawira";

export interface LoreNote {
  id: string;
  opkCategory: string;
  maestroSource: string;
  summary: string;
}

// kata umum yg gak bantu nyari rujukan
const STOP = new Set(["yang", "dengan", "untuk", "dari", "pada", "atau", "dalam", "adalah", "kawasan", "tempat", "bagaimana", "kenapa", "mengapa", "apakah", "tentang", "sejarah", "cerita"]);
const words = (t: string) =>
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9']+/)
    .filter((w) => w.length >= 4 && !STOP.has(w));

// pilih rujukan Pengetahuan Loka yg paling nyambung sama titik & pertanyaan (pencocokan kata sederhana).
// Rujukan yg OPK-nya sama dapat nilai tambah. Maks 3 biar prompt tetap pendek
export function pickNotes(spot: CulturalSpot, notes: LoreNote[], question?: string, max = 3): LoreNote[] {
  const target = new Set([...words(spot.name), ...words(spot.regionName ?? ""), ...words(question ?? "")]);
  return notes
    .map((n) => {
      const hay = new Set(words(`${n.summary} ${n.maestroSource}`));
      let score = 0;
      target.forEach((w) => {
        if (hay.has(w)) score += 2;
      });
      if (n.opkCategory === spot.opkCategory) score += 1;
      return { n, score };
    })
    .filter((x) => x.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map((x) => x.n);
}

// konteks yg dikirim ke model: satu2nya sumber fakta yg boleh dipakai
export function buildContext(spot: CulturalSpot, notes: LoreNote[]): string {
  const lines = [`[R0] Narasi terkurasi titik "${spot.name}" (sumber: ${spot.quest.verifiedLoreSource}): ${spot.quest.loreNarrative}`];
  notes.forEach((n, i) => lines.push(`[R${i + 1}] ${n.opkCategory}, sumber: ${n.maestroSource}: ${n.summary}`));
  return lines.join("\n");
}
