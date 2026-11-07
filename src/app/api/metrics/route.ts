import { NextRequest, NextResponse } from "next/server";
import { getLokawiraStore } from "@/lib/seedCulturalData";
import { currentUser, getMock, jsonError, mockDisabled, ownsSpot, requireRole, visibleSpots } from "@/lib/server/mockBackend";
import { occurrences } from "@/lib/eventRules";
import { tzOf } from "@/lib/spotRules";
import type { MetricType, SpotImpact } from "@/types/lokawira";

const TYPES: MetricType[] = ["QR_OPEN", "REMINDER_SAVED", "GUIDE_START"];
const MAX_LOG = 50_000;

// POST /api/metrics {type, spotId}: catat jejak anonim. Gak nyimpen siapa, cuma jenis + titik + waktu (UU PDP)
export async function POST(request: NextRequest) {
  const off = mockDisabled();
  if (off) return off;
  let b: { type?: string; spotId?: string };
  try {
    b = await request.json();
  } catch {
    return jsonError(400, "Format permintaan tidak valid.");
  }
  if (!TYPES.includes(b.type as MetricType)) return jsonError(400, "Jenis catatan tidak valid.");
  const spot = visibleSpots(currentUser(request)).find((s) => s.id === b.spotId);
  if (!spot) return jsonError(404, "Titik lokasi tidak ditemukan.");
  const log = getLokawiraStore().metrics;
  log.push({ type: b.type as MetricType, spotId: spot.id, at: new Date().toISOString() });
  if (log.length > MAX_LOG) log.splice(0, log.length - MAX_LOG);
  return NextResponse.json({ ok: true }, { status: 202 });
}

// GET /api/metrics?days=30&regionId=: dampak per titik. Mitra = lapaknya, pengelola = semua
export async function GET(request: NextRequest) {
  const off = mockDisabled();
  if (off) return off;
  const auth = requireRole(request, ["MERCHANT", "ADMIN"]);
  if ("res" in auth) return auth.res;
  const sp = new URL(request.url).searchParams;
  const days = Math.max(1, Math.min(365, Number(sp.get("days")) || 30));
  const regionId = sp.get("regionId");
  const since = Date.now() - days * 86400000;
  const inWindow = (iso?: string) => !!iso && /^\d{4}-\d{2}-\d{2}T/.test(iso) && new Date(iso).getTime() >= since;
  const store = getLokawiraStore();
  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * 86400000);

  const spots = store.spots.filter((s) => s.status !== "ARCHIVED" && ownsSpot(auth.user, s.id) && (!regionId || s.regionId === regionId));
  const rows: SpotImpact[] = spots.map((s) => {
    const m = store.metrics.filter((x) => x.spotId === s.id && inWindow(x.at));
    const ci = getMock().checkIns.filter((c) => c.spotId === s.id && inWindow(c.createdAt));
    const vouchers = store.vouchers.filter((v) => v.spotId === s.id);
    const redeemed = vouchers.filter((v) => v.status === "REDEEMED" && inWindow(v.redeemedAt));
    return {
      spotId: s.id,
      spotName: s.name,
      regionId: s.regionId,
      qrOpens: m.filter((x) => x.type === "QR_OPEN").length,
      reminders: m.filter((x) => x.type === "REMINDER_SAVED").length,
      guides: m.filter((x) => x.type === "GUIDE_START").length,
      checkIns: ci.length,
      checkInsVerified: ci.filter((c) => c.verified).length,
      vouchersIssued: vouchers.filter((v) => inWindow(v.issuedAt)).length,
      vouchersRedeemed: redeemed.length,
      redeemedValue: redeemed.reduce((a, v) => a + v.discountAmount, 0),
      upcomingEvents: store.events.filter((e) => e.spotId === s.id).reduce((a, e) => a + occurrences(e, now, in30, tzOf(s)).length, 0),
    };
  });
  const sum = (k: keyof Omit<SpotImpact, "spotId" | "spotName" | "regionId">) => rows.reduce((a, r) => a + r[k], 0);
  const totals = {
    qrOpens: sum("qrOpens"),
    reminders: sum("reminders"),
    guides: sum("guides"),
    checkIns: sum("checkIns"),
    checkInsVerified: sum("checkInsVerified"),
    vouchersIssued: sum("vouchersIssued"),
    vouchersRedeemed: sum("vouchersRedeemed"),
    redeemedValue: sum("redeemedValue"),
    upcomingEvents: sum("upcomingEvents"),
    spotsWithEvents: rows.filter((r) => r.upcomingEvents > 0).length,
    spots: rows.length,
  };
  return NextResponse.json({ days, totals, spots: rows.sort((a, b) => b.checkIns + b.qrOpens - (a.checkIns + a.qrOpens)) });
}
