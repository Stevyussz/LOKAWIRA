import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getLokawiraStore } from "@/lib/seedCulturalData";
import { currentUser, jsonError, merchantBlocked, mockDisabled, ownsSpot, requireRole, visibleSpots } from "@/lib/server/mockBackend";
import { occurrences } from "@/lib/eventRules";
import { tzOf } from "@/lib/spotRules";
import type { CulturalEvent, EventOccurrence, EventRepeat } from "@/types/lokawira";

// GET /api/events?regionId=&spotId=&days=30
// occurrences: kemunculan acara dr sekarang s.d. N hari ke depan, cuma di titik yg keliatan buat user ini.
// events: definisi acara yg boleh dia kelola (mitra: lapaknya, admin: semua), buat dasbor
export async function GET(request: NextRequest) {
  const off = mockDisabled();
  if (off) return off;
  const user = currentUser(request);
  const sp = new URL(request.url).searchParams;
  const days = Math.max(1, Math.min(90, Number(sp.get("days")) || 30));
  const regionId = sp.get("regionId");
  const spotId = sp.get("spotId");
  const store = getLokawiraStore();
  const spots = new Map(visibleSpots(user).map((s) => [s.id, s]));
  const from = new Date();
  const to = new Date(from.getTime() + days * 86400000);

  const list: EventOccurrence[] = [];
  for (const ev of store.events) {
    const s = spots.get(ev.spotId);
    if (!s || (regionId && s.regionId !== regionId) || (spotId && s.id !== spotId)) continue;
    for (const o of occurrences(ev, from, to, tzOf(s))) {
      list.push({ eventId: ev.id, spotId: s.id, spotName: s.name, regionId: s.regionId, title: ev.title, description: ev.description, repeat: ev.repeat, ...o });
    }
  }
  list.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const manageable = user && (user.role === "ADMIN" || user.role === "MERCHANT") ? store.events.filter((e) => ownsSpot(user, e.spotId)) : undefined;
  return NextResponse.json({ occurrences: list.slice(0, 200), events: manageable });
}

// POST /api/events: mitra utk lapaknya sendiri, pengelola utk titik mana pun
export async function POST(request: NextRequest) {
  const off = mockDisabled();
  if (off) return off;
  const auth = requireRole(request, ["MERCHANT", "ADMIN"]);
  if ("res" in auth) return auth.res;
  const blocked = merchantBlocked(auth.user);
  if (blocked) return blocked;
  let b: Record<string, unknown>;
  try {
    b = await request.json();
  } catch {
    return jsonError(400, "Format permintaan tidak valid.");
  }
  const store = getLokawiraStore();
  const spotId = String(b.spotId ?? "");
  const spot = store.spots.find((s) => s.id === spotId && s.status !== "ARCHIVED");
  if (!spot) return jsonError(404, "Titik lokasi tidak ditemukan.");
  if (!ownsSpot(auth.user, spotId)) return jsonError(403, "Ini bukan lapak Anda.", "NOT_YOUR_SPOT");
  const title = String(b.title ?? "").trim();
  if (title.length < 3 || title.length > 80) return jsonError(400, "Judul acara 3 sampai 80 karakter.");
  const description = String(b.description ?? "").trim();
  if (description.length > 300) return jsonError(400, "Keterangan acara maksimal 300 karakter.");
  const repeat = String(b.repeat ?? "NONE") as EventRepeat;
  if (!["NONE", "WEEKLY", "MONTHLY_LAST"].includes(repeat)) return jsonError(400, "Pola ulang tidak valid.");
  const s = new Date(String(b.startsAt ?? "")).getTime();
  const e = new Date(String(b.endsAt ?? "")).getTime();
  if (!Number.isFinite(s) || !Number.isFinite(e)) return jsonError(400, "Isi tanggal dan jam acara.");
  if (e <= s) return jsonError(400, "Waktu selesai harus setelah waktu mulai.");
  if (e - s > 12 * 3600000) return jsonError(400, "Satu acara maksimal 12 jam. Untuk tempat yang buka tiap hari, pakai jam buka.");
  if (repeat === "NONE" && e < Date.now()) return jsonError(400, "Acara ini sudah lewat.");
  if (s > Date.now() + 366 * 86400000) return jsonError(400, "Acara maksimal setahun ke depan.");
  if (store.events.filter((x) => x.spotId === spotId).length >= 20) return jsonError(409, "Maksimal 20 acara per titik. Hapus acara lama dulu.");

  const ev: CulturalEvent = {
    id: `evt-${crypto.randomBytes(5).toString("hex")}`,
    spotId,
    title,
    ...(description ? { description } : {}),
    startsAt: new Date(s).toISOString(),
    endsAt: new Date(e).toISOString(),
    repeat,
    createdAt: new Date().toISOString(),
  };
  store.events.push(ev);
  return NextResponse.json({ event: ev, events: store.events.filter((x) => ownsSpot(auth.user, x.spotId)) }, { status: 201 });
}
