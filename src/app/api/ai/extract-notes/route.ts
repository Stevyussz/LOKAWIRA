import { NextRequest, NextResponse } from "next/server";
import { aiRateLimited, jsonError, mockDisabled, requireRole } from "@/lib/server/mockBackend";
import { AssistError, extractNotes } from "@/lib/server/loka";
import { OPK_VALUES } from "@/lib/enums";
import type { OpkCategory } from "@/types/lokawira";
import type { ExtractNotesResponse } from "@/types/api";

// POST /api/ai/extract-notes {text, opkCategory}: pecah teks sumber jadi draf rujukan. Belum disimpan, pengelola yg memilih
export async function POST(request: NextRequest) {
  const off = mockDisabled();
  if (off) return off;
  const auth = requireRole(request, ["ADMIN"]);
  if ("res" in auth) return auth.res;
  let b: Record<string, unknown>;
  try {
    b = await request.json();
  } catch {
    return jsonError(400, "Format permintaan tidak valid.");
  }
  if (!OPK_VALUES.includes(b.opkCategory as OpkCategory)) return jsonError(400, "Kategori OPK tidak valid.");
  const limited = aiRateLimited(`extract:${auth.user.id}`, 10, 600_000);
  if (limited) return limited;
  try {
    const r = await extractNotes({ text: String(b.text ?? ""), opk: b.opkCategory as OpkCategory });
    return NextResponse.json(r satisfies ExtractNotesResponse);
  } catch (e) {
    if (e instanceof AssistError) return jsonError(400, e.message);
    throw e;
  }
}
