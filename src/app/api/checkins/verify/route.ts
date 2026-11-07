import { mockDisabled } from "@/lib/server/mockBackend";
import { NextRequest, NextResponse } from "next/server";
import { getLokawiraStore } from "@/lib/seedCulturalData";
import { awardXp, getMock, jsonError, ownsSpot, requireRole } from "@/lib/server/mockBackend";

// mitra meverifikasi kode kehadira pengnjung di lappaknya, sekali saj
export async function POST(request: NextRequest) {
  const off = mockDisabled();
  if (off) return off;
  const auth = requireRole(request, ["MERCHANT", "ADMIN"]);
  if ("res" in auth) return auth.res;

  let body: { code?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Format permintaan tidak valid.");
  }
  const code = String(body.code ?? "").trim().toUpperCase();
  if (!code) return jsonError(400, "Masukkan kode kehadiran pengunjung.");

  const rec = getMock().checkIns.find((c) => c.code === code);
  if (!rec) return jsonError(404, `Kode "${code}" tidak ditemukan.`, "CHECKIN_NOT_FOUND");
  if (!ownsSpot(auth.user, rec.spotId)) {
    return jsonError(403, "Kode ini untuk lapak lain, bukan lapak Anda.", "NOT_YOUR_SPOT");
  }
  if (rec.verified) return jsonError(409, `Kode "${code}" sudah pernah diverifikasi.`, "CHECKIN_ALREADY_VERIFIED");
  // kode kehadiran berlaku 24 jam: bukti hadir hari itu, bkn bisa ditukar kapan aja
  if (Date.now() - new Date(rec.createdAt).getTime() > 24 * 3600 * 1000) {
    return jsonError(410, `Kode "${code}" sudah lewat 24 jam dan tidak berlaku lagi.`, "CHECKIN_EXPIRED");
  }

  const spot = getLokawiraStore().spots.find((s) => s.id === rec.spotId);
  rec.verified = true;
  rec.verifiedAt = new Date().toISOString();
  // XP verifikasi masuk ke wisatawan yg check-in (kalo dia login). Tamu: gak ada akun buat dicatat
  const points = rec.userId ? spot?.quest.rewardPoints ?? 0 : 0;
  awardXp(rec.userId, points);
  return NextResponse.json({
    verified: true,
    spotId: rec.spotId,
    spotName: spot?.name ?? "",
    awardedPoints: points,
    visitorHasAccount: !!rec.userId,
  });
}
