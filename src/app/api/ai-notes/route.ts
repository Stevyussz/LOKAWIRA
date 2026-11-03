import { NextRequest, NextResponse } from "next/server";
import { getLokawiraStore } from "@/lib/seedCulturalData";
import { jsonError, mockDisabled, requireRole } from "@/lib/server/mockBackend";

// POST /api/ai-notes: pengelola nambah rujukan Pengetahuan Loka
export async function POST(request: NextRequest) {
  const off = mockDisabled();
  if (off) return off;
  const auth = requireRole(request, ["ADMIN"]);
  if ("res" in auth) return auth.res;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Format permintaan tidak valid.");
  }
  const store = getLokawiraStore();
  const note = {
    id: `rag-${Date.now().toString().slice(-4)}`,
    opkCategory: String(body.opkCategory ?? ""),
    maestroSource: String(body.maestroSource ?? ""),
    summary: String(body.summary ?? ""),
    updatedAt: "Baru saja disinkronkan",
  };
  store.aiTrainingNotes.unshift(note);
  return NextResponse.json({ aiTrainingNotes: store.aiTrainingNotes }, { status: 201 });
}
