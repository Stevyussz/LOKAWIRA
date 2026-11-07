import { mockDisabled } from "@/lib/server/mockBackend";
import { NextRequest, NextResponse } from "next/server";
import { generateCulturalStoryAndValidation } from "@/lib/nineRouterClient";
import { getLokawiraStore } from "@/lib/seedCulturalData";
import { buildContext, pickNotes } from "@/lib/server/loreContext";

export async function POST(request: NextRequest) {
  const off = mockDisabled();
  if (off) return off;
  try {
    const body = await request.json();
    const { spotId, customQuestion } = body;
    const store = getLokawiraStore();
    const spot = store.spots.find((s) => s.id === spotId) || store.spots[0];

    const question = typeof customQuestion === "string" ? customQuestion.trim().slice(0, 300) : "";
    // rujukan dr dasbor Pengelola (Pengetahuan Loka) yg nyambung sama titik/pertanyaan ikut jadi bahan cerita
    const notes = pickNotes(spot, store.aiTrainingNotes, question);
    const top = notes[0];
    const result = await generateCulturalStoryAndValidation({
      spotName: spot.name,
      opkCategory: spot.opkCategory,
      verifiedLoreSource: spot.quest.verifiedLoreSource,
      riddleClue: spot.quest.riddleClue,
      context: buildContext(spot, notes),
      // cadangan tanpa AI: narasi titik, ditambah rujukan paling relevan kalo ada
      loreNarrative: question
        ? top
          ? `Soal "${question}": menurut ${top.maestroSource}, ${top.summary} ${spot.quest.loreNarrative}`
          : `Soal "${question}": rujukan khususnya belum ada di Pengetahuan Loka. Yang tercatat dari ${spot.quest.verifiedLoreSource}: ${spot.quest.loreNarrative}`
        : spot.quest.loreNarrative,
      userQueryOrImageBase64: question || undefined,
      mode: "STORYTELLER",
    });

    return NextResponse.json({
      spotId: spot.id,
      spotName: spot.name,
      opkCategory: spot.opkCategory,
      verifiedSource: spot.quest.verifiedLoreSource,
      references: [spot.quest.verifiedLoreSource, ...notes.map((n) => n.maestroSource)].filter((v, i, a) => a.indexOf(v) === i),
      riddleTitle: spot.quest.riddleTitle,
      ...result,
    });
  } catch {
    return NextResponse.json(
      { error: "Gagal memuat narasi dari AI StoryTeller" },
      { status: 500 }
    );
  }
}
