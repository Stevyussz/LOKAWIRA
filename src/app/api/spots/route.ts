import { mockDisabled } from "@/lib/server/mockBackend";
import { NextRequest, NextResponse } from "next/server";
import { inIndonesia } from "@/lib/geo";
import { applyInfo, parseEntry, parseEvent, parseHours, parseInfo } from "@/lib/spotRules";
import { OPK_VALUES, SPOT_TYPES } from "@/lib/enums";
import { distanceMeters } from "@/lib/geo";
import { regionFor, visibleRegions } from "@/lib/server/regions";
import { getLokawiraStore } from "@/lib/seedCulturalData";
import { CulturalSpot, CulturalVibe } from "@/types/lokawira";
import { currentUser, jsonError, merchantBlocked, profileOf, requireRole, visibleSpots } from "@/lib/server/mockBackend";

export async function GET(request: NextRequest) {
  const off = mockDisabled();
  if (off) return off;
  const store = getLokawiraStore();
  const { searchParams } = new URL(request.url);
  const vibe = searchParams.get("vibe") as CulturalVibe | null;

  const user = currentUser(request);
  // arsip gak tampil, titik yg menunggu review cuma utk pemilik & pengelola
  const live = visibleSpots(user);
  // saring per kawasan (regionId), atau per palet (vibe, cara lama)
  const regionId = searchParams.get("regionId");
  const spots = live.filter((spot) => (!vibe || spot.vibe === vibe) && (!regionId || spot.regionId === regionId));

  // mitra hnya melihat voucer lapakny dn gak meliihat tiket wisatwan
  const mine = new Set(store.spots.filter((s) => s.ownerId === user?.id).map((s) => s.id));
  const isMerchant = user?.role === "MERCHANT";

  const prof = user?.role === "VISITOR" ? profileOf(user.id) : null;
  return NextResponse.json({
    spots,
    // tamu (belum login) gak dikasih voucer/tiket siapa pun: tas tamu cuma ada di perangkatnya. Admin dapat semua
    vouchers: prof
      ? store.vouchers.filter((v) => prof.voucherCodes.has(v.code))
      : isMerchant
      ? store.vouchers.filter((v) => mine.has(v.spotId))
      : user?.role === "ADMIN"
      ? store.vouchers
      : [],
    reservations: prof ? store.reservations.filter((r) => prof.ticketIds.has(r.ticketId)) : user?.role === "ADMIN" ? store.reservations : [],
    aiTrainingNotes: store.aiTrainingNotes,
    regions: visibleRegions(user?.role === "ADMIN"),
  });
}

// POST /api/spots: tambah titik. Body = objek CulturalSpot langsung (bukan lagi dibungkus action)
export async function POST(request: NextRequest) {
  const off = mockDisabled();
  if (off) return off;
  const auth = requireRole(request, ["MERCHANT", "ADMIN"]);
  if ("res" in auth) return auth.res;
  let input: CulturalSpot | undefined;
  try {
    input = await request.json();
  } catch {
    return jsonError(400, "Format permintaan tidak valid.");
  }
  const store = getLokawiraStore();
  const lat = Number(input?.coordinates?.lat);
  const lng = Number(input?.coordinates?.lng);
  if (!input || !String(input.name ?? "").trim() || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return jsonError(400, "Nama dan lokasi pin wajib diisi.");
  }
  // peta dikunci ke Indonesia: pin di luar itu gak bakal keliatan
  if (!inIndonesia({ lat, lng })) return jsonError(400, "Lokasi pin harus berada di wilayah Indonesia.", "OUT_OF_INDONESIA");
  const blocked = merchantBlocked(auth.user);
  if (blocked) return blocked;
  const vr = input.quest?.voucherReward;
  const disc = Number(vr?.discountAmount);
  const minS = Number(vr?.minimumSpend);
  if (!Number.isFinite(disc) || disc < 1000 || disc > 100000) return jsonError(400, "Nominal diskon harus Rp1.000 sampai Rp100.000.");
  if (!Number.isFinite(minS) || minS < 0 || minS > 10_000_000) return jsonError(400, "Minimal belanja tidak valid.");
  if (!String(input.quest?.targetObjectPrompt ?? "").trim()) return jsonError(400, "Tulis objek yang harus dipindai wisatawan.");
  if (auth.user.role === "MERCHANT" && input.spotType === "PRIMARY_DEST") {
    return jsonError(403, "Hanya pengelola yang boleh menambah cagar budaya utama.", "FORBIDDEN");
  }
  // enum dicek (dulu string apa aja diterima)
  if (!SPOT_TYPES.includes(input.spotType)) return jsonError(400, "Jenis titik tidak valid.");
  if (!OPK_VALUES.includes(input.opkCategory)) return jsonError(400, "Kategori OPK tidak valid.");
  // kawasan ditentukan dr lokasi pin, bkn pilihan klien (dulu mitra bisa milih kawasan yg jauhnya ratusan km)
  const region = regionFor({ lat, lng });
  if (!region && auth.user.role === "ADMIN") {
    return jsonError(400, "Lokasi ini di luar semua kawasan. Buat atau perluas kawasan dulu di tab Kawasan.", "OUT_OF_REGION");
  }
  // di luar kawasan: palet ngikut kawasan terdekat biar tetep berwarna di dasbor
  const nearest = region ?? [...store.regions].sort((a, b) => distanceMeters({ lat, lng }, a.center) - distanceMeters({ lat, lng }, b.center))[0];
  const proposal = String(input.regionProposal ?? "").trim().slice(0, 80);
  // lapak mitra maks 500, titik pengelola (candi, festival) maks 5.000
  const capMax = auth.user.role === "ADMIN" ? 5000 : 500;
  const cap = Number(input.quota?.maxCapacity);
  if (!Number.isInteger(cap) || cap < 1 || cap > capMax) return jsonError(400, `Kapasitas 1 sampai ${capMax.toLocaleString("id-ID")} orang.`);
  // cara masuk, jam buka, acara: opsional tapi kalo diisi harus sah
  let entry, openingHours, event;
  if (input.entry) {
    entry = parseEntry(input.entry);
    if (typeof entry === "string") return jsonError(400, entry);
  }
  if (input.openingHours) {
    openingHours = parseHours(input.openingHours);
    if (typeof openingHours === "string") return jsonError(400, openingHours);
  }
  if (input.event) {
    event = parseEvent(input.event);
    if (typeof event === "string") return jsonError(400, event);
  }
  const isAdmin = auth.user.role === "ADMIN";
  const highlight = String(input.highlight ?? "").trim();
  if (highlight.length > 100) return jsonError(400, "Kalimat \"kenapa layak mampir\" maksimal 100 karakter.");
  const info = parseInfo(input);
  if (typeof info === "string") return jsonError(400, info);
  const newSpot: CulturalSpot = {
    ...input,
    id: `spot-${Date.now().toString(36)}`,
    ownerId: auth.user.role === "MERCHANT" ? auth.user.id : undefined,
    createdAt: new Date().toISOString(),
    // titik mitra nunggu review pengelola, titik pengelola langsung terbit
    status: auth.user.role === "MERCHANT" ? "PENDING_REVIEW" : "PUBLISHED",
    coordinates: { lat, lng },
    entry,
    openingHours,
    event,
    highlight: highlight || undefined,
    vibe: nearest?.theme ?? "majapahit",
    regionName: region ? `${region.name}, ${region.label}` : "Di luar kawasan",
    regionId: region?.id,
    regionProposal: region ? undefined : proposal || undefined,
    // angka kepadatan selalu mulai dr nol (bkn dr klien)
    quota: { currentVisitors: 0, maxCapacity: cap, estimatedWaitMinutes: 0, nextAvailableSlot: "Tersedia langsung" },
  };
  // XP misi cuma boleh diatur pengelola: mitra dpt nilai bawaan 100
  const xp = Number(input.quest?.rewardPoints);
  newSpot.quest = { ...newSpot.quest, rewardPoints: isAdmin && Number.isFinite(xp) ? Math.max(0, Math.min(1000, Math.round(xp))) : 100, referenceImages: [] };
  // galeri cuma lewat unggah foto, bkn dr body; info tempat lewat validasi yg sama dgn PATCH
  delete newSpot.gallery;
  applyInfo(newSpot, info);
  store.spots.unshift(newSpot);
  return NextResponse.json({ spot: newSpot, spots: visibleSpots(auth.user) }, { status: 201 });
}
