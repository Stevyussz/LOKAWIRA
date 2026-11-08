import { NextRequest, NextResponse } from "next/server";
import { aiRateLimited, currentUser, jsonError, lokaGapLog, mockDisabled, visibleSpots } from "@/lib/server/mockBackend";
import { getLokawiraStore } from "@/lib/seedCulturalData";
import { askLoka, parseHistory, scrubQuestion } from "@/lib/server/loka";
import type { StorytellerResponse } from "@/types/api";

// POST /api/ai/storyteller {spotId, customQuestion?, history?}: tanya Loka soal titik ini
export async function POST(request: NextRequest) {
  const off = mockDisabled();
  if (off) return off;
  let body: { spotId?: unknown; customQuestion?: unknown; history?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Format permintaan tidak valid.");
  }
  const user = currentUser(request);
  const limited = aiRateLimited(`story:${user?.id ?? request.headers.get("x-forwarded-for") ?? "anon"}`, 40, 600_000);
  if (limited) return limited;
  const spots = visibleSpots(user);
  const spot = spots.find((s) => s.id === body.spotId);
  if (!spot) return jsonError(404, "Titik lokasi tidak ditemukan.");
  const store = getLokawiraStore();
  const question = typeof body.customQuestion === "string" ? body.customQuestion.trim().slice(0, 300) : "";
  const res = await askLoka({ spot, question, history: parseHistory(body.history), notes: store.aiTrainingNotes, world: { events: store.events, spots } });
  if (question && !res.answered) {
    const log = lokaGapLog();
    log.push({ spotId: spot.id, question: scrubQuestion(question), at: new Date().toISOString() });
    if (log.length > 2000) log.splice(0, log.length - 2000);
  }
  return NextResponse.json({
    spotId: spot.id,
    spotName: spot.name,
    opkCategory: spot.opkCategory,
    verifiedSource: spot.quest.verifiedLoreSource,
    references: res.references,
    riddleTitle: spot.quest.riddleTitle,
    isVerified: true,
    sourceMode: res.mode,
    story: res.answer,
    riddle: spot.quest.riddleClue,
    answer: res.answer,
    answered: res.answered,
    followUps: res.followUps,
  } satisfies StorytellerResponse);
}
