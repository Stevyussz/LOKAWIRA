import { NextRequest, NextResponse } from "next/server";
import { inIndonesia } from "@/lib/geo";
import { getLokawiraStore } from "@/lib/seedCulturalData";
import { jsonError, merchantBlocked, mockDisabled, ownsSpot, requireRole, visibleSpots } from "@/lib/server/mockBackend";
import type { UpdateSpotRequest } from "@/types/api";
import { applyInfo, parseEntry, parseEvent, parseHours, parseInfo, storyChanged } from "@/lib/spotRules";
import { OPK_VALUES, SPOT_TYPES } from "@/lib/enums";
import { applyRegion, regionFor } from "@/lib/server/regions";

type Ctx = { params: Promise<{ id: string }> };

// PATCH /api/spots/{id}: mitra cuma lapak miliknya, field sensitif cuma dr ADMIN
export async function PATCH(request: NextRequest, ctx: Ctx) {
  const off = mockDisabled();
  if (off) return off;
  const auth = requireRole(request, ["MERCHANT", "ADMIN"]);
  if ("res" in auth) return auth.res;
  const blocked = merchantBlocked(auth.user);
  if (blocked) return blocked;
  const { id } = await ctx.params;
  const store = getLokawiraStore();
  const target = store.spots.find((s) => s.id === id);
  if (!target || target.status === "ARCHIVED") return jsonError(404, "Titik lokasi tidak ditemukan.");
  if (!ownsSpot(auth.user, id)) return jsonError(403, "Ini bukan lapak Anda.", "NOT_YOUR_SPOT");

  let body: UpdateSpotRequest;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Format permintaan tidak valid.");
  }
  const isAdmin = auth.user.role === "ADMIN";
  const before = { name: target.name, lat: target.coordinates.lat, lng: target.coordinates.lng };
  // semua perubahan dicoba di salinan dulu: kalo satu field gagal validasi, gak ada yg setengah tersimpan
  const draft = structuredClone(target);

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (name.length < 3) return jsonError(400, "Nama minimal 3 karakter.");
    draft.name = name;
    draft.quest.voucherReward.merchantName = name;
  }
  if (body.address !== undefined) {
    const a = String(body.address).trim();
    if (a.length < 5) return jsonError(400, "Alamat terlalu pendek.");
    draft.address = a;
  }
  if (body.facilities !== undefined) {
    if (!Array.isArray(body.facilities)) return jsonError(400, "Fasilitas tidak valid.");
    draft.facilities = body.facilities.map(String).slice(0, 12);
  }
  if (body.coordinates !== undefined) {
    const lat = Number(body.coordinates.lat);
    const lng = Number(body.coordinates.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return jsonError(400, "Koordinat tidak valid.");
    if (!inIndonesia({ lat, lng })) return jsonError(400, "Lokasi pin harus berada di wilayah Indonesia.", "OUT_OF_INDONESIA");
    draft.coordinates = { lat, lng };
    // pindah lokasi = kawasan dihitung ulang
    const region = regionFor({ lat, lng });
    if (!region && isAdmin) return jsonError(400, "Lokasi baru di luar semua kawasan. Buat atau perluas kawasan dulu.", "OUT_OF_REGION");
    applyRegion(draft, region);
    if (!region) draft.regionName = "Di luar kawasan";
  }
  if (body.quota?.maxCapacity !== undefined) {
    const cap = Number(body.quota.maxCapacity);
    const capMax = isAdmin ? 5000 : 500;
    if (!Number.isInteger(cap) || cap < 1 || cap > capMax) return jsonError(400, `Kapasitas 1 sampai ${capMax.toLocaleString("id-ID")} orang.`);
    draft.quota.maxCapacity = cap;
    draft.quota.currentVisitors = Math.min(draft.quota.currentVisitors, cap);
  }
  if (body.quest) {
    const q = body.quest;
    if (q.riddleTitle !== undefined) draft.quest.riddleTitle = String(q.riddleTitle).trim();
    if (q.riddleClue !== undefined) {
      const c = String(q.riddleClue).trim();
      if (c.length < 10) return jsonError(400, "Petunjuk misi minimal 10 karakter.");
      draft.quest.riddleClue = c;
    }
    if (q.loreNarrative !== undefined) draft.quest.loreNarrative = String(q.loreNarrative).trim();
    if (q.targetObjectPrompt !== undefined) draft.quest.targetObjectPrompt = String(q.targetObjectPrompt).trim();
    if (isAdmin && q.verifiedLoreSource !== undefined) draft.quest.verifiedLoreSource = String(q.verifiedLoreSource).trim();
    if (isAdmin && q.rewardPoints !== undefined) {
      draft.quest.rewardPoints = Math.max(0, Math.min(1000, Number(q.rewardPoints) || 0));
    }
  }
  // mitra ngubah nama, lokasi, atau teks budaya (cerita/petunjuk/objek misi): titik balik ditinjau ulang pengelola
  const moved = draft.coordinates.lat !== before.lat || draft.coordinates.lng !== before.lng;
  if (!isAdmin && (draft.name !== before.name || moved || storyChanged(target, draft))) draft.status = "PENDING_REVIEW";
  if (isAdmin) {
    // nilai enum dicek, dulu string apa aja diterima
    if (body.spotType) {
      if (!SPOT_TYPES.includes(body.spotType)) return jsonError(400, "Jenis titik tidak valid.");
      draft.spotType = body.spotType;
    }
    if (body.opkCategory) {
      if (!OPK_VALUES.includes(body.opkCategory)) return jsonError(400, "Kategori OPK tidak valid.");
      draft.opkCategory = body.opkCategory;
    }
    // vibe & regionName gak diterima lagi: dua2nya ngikut kawasan dr lokasi pin
    if (body.event !== undefined) {
      if (body.event === null) delete draft.event;
      else {
        const ev = parseEvent(body.event);
        if (typeof ev === "string") return jsonError(400, ev);
        draft.event = ev;
      }
    }
  }
  if (body.highlight !== undefined) {
    const h = String(body.highlight ?? "").trim();
    if (h.length > 100) return jsonError(400, "Kalimat \"kenapa layak mampir\" maksimal 100 karakter.");
    if (h) draft.highlight = h;
    else delete draft.highlight;
  }
  // info tempat (deskripsi, peraturan, kontak): langsung tampil
  const info = parseInfo(body);
  if (typeof info === "string") return jsonError(400, info);
  applyInfo(draft, info);
  // cara masuk & jam buka boleh diatur mitra (lapaknya) maupun pengelola. null = hapus
  if (body.entry !== undefined) {
    if (body.entry === null) delete draft.entry;
    else {
      const en = parseEntry(body.entry);
      if (typeof en === "string") return jsonError(400, en);
      draft.entry = en;
    }
  }
  if (body.openingHours !== undefined) {
    if (body.openingHours === null) delete draft.openingHours;
    else {
      const h = parseHours(body.openingHours);
      if (typeof h === "string") return jsonError(400, h);
      draft.openingHours = h;
    }
  }
  for (const k of Object.keys(target) as (keyof typeof target)[]) if (!(k in draft)) delete target[k];
  Object.assign(target, draft);
  return NextResponse.json({ spot: target, spots: visibleSpots(auth.user) });
}

// DELETE /api/spots/{id}: soft delete (ARCHIVED), data riwayat voucer & tiket tetap utuh
export async function DELETE(request: NextRequest, ctx: Ctx) {
  const off = mockDisabled();
  if (off) return off;
  const auth = requireRole(request, ["MERCHANT", "ADMIN"]);
  if ("res" in auth) return auth.res;
  const { id } = await ctx.params;
  const store = getLokawiraStore();
  const target = store.spots.find((s) => s.id === id);
  if (!target || target.status === "ARCHIVED") return jsonError(404, "Titik lokasi tidak ditemukan.");
  if (!ownsSpot(auth.user, id)) return jsonError(403, "Ini bukan lapak Anda.", "NOT_YOUR_SPOT");
  if (target.spotType === "PRIMARY_DEST" && auth.user.role !== "ADMIN") {
    return jsonError(403, "Cagar budaya utama hanya bisa diarsipkan pengelola.", "FORBIDDEN");
  }
  target.status = "ARCHIVED";
  return NextResponse.json({ spots: visibleSpots(auth.user) });
}
