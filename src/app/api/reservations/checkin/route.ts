import { mockDisabled } from "@/lib/server/mockBackend";
import { NextRequest, NextResponse } from "next/server";
import { getLokawiraStore } from "@/lib/seedCulturalData";
import { jsonError, requireRole } from "@/lib/server/mockBackend";

// Pengelola menndai E-Ticket udah dipkae masuk
export async function POST(request: NextRequest) {
  const off = mockDisabled();
  if (off) return off;
  const auth = requireRole(request, ["ADMIN"]);
  if ("res" in auth) return auth.res;

  let body: { ticketId?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Format permintaan tidak valid.");
  }
  const store = getLokawiraStore();
  const r = store.reservations.find((x) => x.ticketId === body.ticketId);
  if (!r) return jsonError(404, "E-Ticket tidak ditemukan.");
  if (r.status === "CHECKED_IN") return jsonError(409, "E-Ticket ini sudah dipakai masuk.", "TICKET_ALREADY_USED");
  r.status = "CHECKED_IN";
  return NextResponse.json({ reservation: r, reservations: store.reservations });
}
