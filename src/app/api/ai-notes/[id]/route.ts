import { NextRequest, NextResponse } from "next/server";
import { getLokawiraStore } from "@/lib/seedCulturalData";
import { jsonError, mockDisabled, requireRole } from "@/lib/server/mockBackend";

type Ctx = { params: Promise<{ id: string }> };

// PATCH /api/ai-notes/{id}: ubah sebagian field rujukan (kategori, sumber, ringkasan)
export async function PATCH(request: NextRequest, ctx: Ctx) {
  const off = mockDisabled();
  if (off) return off;
  const auth = requireRole(request, ["ADMIN"]);
  if ("res" in auth) return auth.res;
  const { id } = await ctx.params;
  const store = getLokawiraStore();
  const note = store.aiTrainingNotes.find((n) => n.id === id);
  if (!note) return jsonError(404, "Rujukan tidak ditemukan.");
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Format permintaan tidak valid.");
  }
  if (body.maestroSource !== undefined) {
    const v = String(body.maestroSource).trim();
    if (v.length < 5) return jsonError(400, "Sumber minimal 5 huruf.");
    note.maestroSource = v;
  }
  if (body.summary !== undefined) {
    const v = String(body.summary).trim();
    if (v.length < 20) return jsonError(400, "Ringkasan minimal 20 huruf.");
    note.summary = v;
  }
  if (body.opkCategory !== undefined) note.opkCategory = body.opkCategory as typeof note.opkCategory;
  note.updatedAt = "Baru saja disinkronkan";
  return NextResponse.json({ aiTrainingNotes: store.aiTrainingNotes });
}

// DELETE /api/ai-notes/{id}
export async function DELETE(request: NextRequest, ctx: Ctx) {
  const off = mockDisabled();
  if (off) return off;
  const auth = requireRole(request, ["ADMIN"]);
  if ("res" in auth) return auth.res;
  const { id } = await ctx.params;
  const store = getLokawiraStore();
  const idx = store.aiTrainingNotes.findIndex((n) => n.id === id);
  if (idx < 0) return jsonError(404, "Rujukan tidak ditemukan.");
  store.aiTrainingNotes.splice(idx, 1);
  return NextResponse.json({ aiTrainingNotes: store.aiTrainingNotes });
}
