import { NextRequest, NextResponse } from "next/server";
import { getLokawiraStore } from "@/lib/seedCulturalData";
import { getMock, mockDisabled, profileOf, requireRole } from "@/lib/server/mockBackend";
import type { ProfileResponse } from "@/types/api";

// GET /api/me/profile - XP, level, titik yg udh check-in, kartu lore, voucer, dan tiket MILIK SENDIRI
export async function GET(request: NextRequest) {
  const off = mockDisabled();
  if (off) return off;
  const auth = requireRole(request, ["VISITOR", "MERCHANT", "ADMIN"]);
  if ("res" in auth) return auth.res;
  const prof = profileOf(auth.user.id);
  const store = getLokawiraStore();
  const body: ProfileResponse = {
    xp: prof.xp,
    level: Math.floor(prof.xp / 150) + 1,
    checkedInSpotIds: [...new Set(getMock().checkIns.filter((c) => c.userId === auth.user.id).map((c) => c.spotId))],
    loreCards: prof.loreCards,
    vouchers: store.vouchers.filter((v) => prof.voucherCodes.has(v.code)),
    reservations: store.reservations.filter((r) => prof.ticketIds.has(r.ticketId)),
  };
  return NextResponse.json(body);
}
