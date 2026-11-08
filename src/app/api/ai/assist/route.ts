import { NextRequest, NextResponse } from "next/server";
import { getLokawiraStore } from "@/lib/seedCulturalData";
import { aiRateLimited, jsonError, merchantBlocked, mockDisabled, ownsSpot, requireRole } from "@/lib/server/mockBackend";
import { AssistError, polishInfo, suggestClues } from "@/lib/server/loka";
import type { AssistResponse } from "@/types/api";

// POST /api/ai/assist: Loka bantu mitra menulis (rapikan Info tempat, saran petunjuk misi)
export async function POST(request: NextRequest) {
  const off = mockDisabled();
  if (off) return off;
  const auth = requireRole(request, ["MERCHANT", "ADMIN"]);
  if ("res" in auth) return auth.res;
  const blocked = merchantBlocked(auth.user);
  if (blocked) return blocked;
  let b: Record<string, unknown>;
  try {
    b = await request.json();
  } catch {
    return jsonError(400, "Format permintaan tidak valid.");
  }
  const limited = aiRateLimited(`assist:${auth.user.id}`, 30, 600_000);
  if (limited) return limited;
  let spot = undefined;
  if (b.spotId !== undefined) {
    spot = getLokawiraStore().spots.find((s) => s.id === b.spotId && s.status !== "ARCHIVED");
    if (!spot) return jsonError(404, "Titik lokasi tidak ditemukan.");
    if (!ownsSpot(auth.user, spot.id)) return jsonError(403, "Ini bukan lapak Anda.", "NOT_YOUR_SPOT");
  }
  try {
    if (b.task === "polish-info") {
      const r = await polishInfo({ spot, notes: String(b.notes ?? "") });
      return NextResponse.json(r satisfies AssistResponse);
    }
    if (b.task === "suggest-clue") {
      if (!spot) return jsonError(400, "Pilih lapaknya dulu.");
      const r = await suggestClues({
        name: spot.name,
        target: typeof b.target === "string" && b.target.trim() ? b.target.trim().slice(0, 120) : spot.quest.targetObjectPrompt,
        story: typeof b.story === "string" ? b.story.slice(0, 800) : spot.quest.loreNarrative,
      });
      return NextResponse.json(r satisfies AssistResponse);
    }
    return jsonError(400, "Tugas Loka tidak dikenal.");
  } catch (e) {
    if (e instanceof AssistError) return jsonError(400, e.message);
    throw e;
  }
}
