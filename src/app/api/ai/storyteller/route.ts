import { mockDisabled } from "@/lib/server/mockBackend";
import { NextRequest, NextResponse } from "next/server";
import { generateCulturalStoryAndValidation } from "@/lib/nineRouterClient";
import { getLokawiraStore } from "@/lib/seedCulturalData";

export async function POST(request: NextRequest) {
  const off = mockDisabled();
  if (off) return off;
  try {
    const body = await request.json();
    const { spotId, customQuestion } = body;
    const store = getLokawiraStore();
    const spot = store.spots.find((s) => s.id === spotId) || store.spots[0];

    const result = await generateCulturalStoryAndValidation({
      spotName: spot.name,
      opkCategory: spot.opkCategory,
      verifiedLoreSource: spot.quest.verifiedLoreSource,
      riddleClue: spot.quest.riddleClue,
      loreNarrative: customQuestion
        ? `Menjawab pertanyaan Anda tentang "${customQuestion}" di ${spot.name}: Berdasarkan rujukan ${spot.quest.verifiedLoreSource}, ${spot.quest.loreNarrative}`
        : spot.quest.loreNarrative,
      userQueryOrImageBase64: customQuestion,
      mode: "STORYTELLER",
    });

    return NextResponse.json({
      spotId: spot.id,
      spotName: spot.name,
      opkCategory: spot.opkCategory,
      verifiedSource: spot.quest.verifiedLoreSource,
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
