import type { FastifyInstance } from "fastify";
import type { AuthUser, CulturalSpot, IssuedVoucher, ReservationPass } from "@/types/lokawira";
import { inIndonesia } from "@/lib/geo";
import { parseEntry, parseEvent, parseHours } from "@/lib/spotRules";
import { OPK_VALUES, SPOT_TYPES } from "@/lib/enums";
import { distanceMeters } from "@/lib/geo";
import { pool, tx } from "../db.js";
import {
  applyRegion, bad, estimatedWait, fail, getEntity, listEntities, listRegions, newId, regionFor, saveEntity, visibleRegions, visibleSpots,
} from "../core.js";
import { bodyOf, currentUser, requireRoles } from "../http.js";
import { myRecords } from "./auth.js";

const MAX_IMAGES = 5;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
export function imageSignatureMatches(type: string, data: Buffer) {
  if (type === "image/jpeg") return data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  if (type === "image/png") return data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (type === "image/webp") return data.length >= 12 && data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WEBP";
  return false;
}

const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
const capMaxFor = (u: AuthUser) => (u.role === "ADMIN" ? 5000 : 500);

function coordsOf(v: unknown) {
  const c = v as { lat?: unknown; lng?: unknown } | undefined;
  const lat = Number(c?.lat);
  const lng = Number(c?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) bad("Koordinat pin tidak valid.");
  if (!inIndonesia({ lat, lng })) fail(400, "Lokasi pin harus berada di wilayah Indonesia.", "OUT_OF_INDONESIA");
  return { lat, lng };
}
function facilitiesOf(v: unknown) {
  if (!Array.isArray(v) || v.length > 12 || v.some((x) => typeof x !== "string")) bad("Daftar fasilitas tidak valid (maks 12).");
  return (v as string[]).map((x) => x.trim().slice(0, 60)).filter(Boolean);
}
function highlightOf(v: unknown) {
  const h = str(v, 1000);
  if (h.length > 100) bad('Kalimat "kenapa layak mampir" maksimal 100 karakter.');
  return h || undefined;
}
function parsedOr<T>(v: T | string): T {
  if (typeof v === "string") bad(v);
  return v as T;
}
function moneyOf(amount: unknown, minimum: unknown) {
  const disc = Number(amount);
  const min = Number(minimum);
  if (!Number.isInteger(disc) || disc < 1000 || disc > 100000) bad("Nominal diskon harus Rp1.000 sampai Rp100.000.");
  if (!Number.isFinite(min) || min < 0 || min > 10_000_000) bad("Minimal belanja tidak valid.");
  return { disc, min: Math.round(min) };
}

// daftar titik + data milik user (voucer/tiket wisatawan, voucer lapak mitra, semua utk pengelola)
async function snapshot(user: AuthUser | null, filter: { vibe?: string; regionId?: string } = {}) {
  const [spotsAll, regions] = await Promise.all([visibleSpots(pool, user), listRegions(pool)]);
  const spots = spotsAll.filter((s) => (!filter.vibe || s.vibe === filter.vibe) && (!filter.regionId || s.regionId === filter.regionId));
  let vouchers: IssuedVoucher[] = [];
  let reservations: ReservationPass[] = [];
  if (user?.role === "VISITOR") ({ vouchers, reservations } = await myRecords(user.id));
  else if (user?.role === "MERCHANT") {
    const r = await pool.query<{ payload: IssuedVoucher }>(
      "SELECT v.payload FROM entities v WHERE v.kind='voucher' AND v.payload->>'spotId' IN (SELECT id FROM entities WHERE kind='spot' AND owner_id=$1) ORDER BY v.created_at DESC",
      [user.id]
    );
    vouchers = r.rows.map((x) => x.payload);
  } else if (user?.role === "ADMIN") {
    vouchers = (await listEntities<IssuedVoucher>(pool, "voucher")).map((x) => x.payload);
    reservations = (await listEntities<ReservationPass>(pool, "reservation")).map((x) => x.payload);
  }
  const aiTrainingNotes = user?.role === "ADMIN" ? (await listEntities<Record<string, unknown>>(pool, "ai-note")).map((x) => x.payload) : [];
  return { spots, vouchers, reservations, aiTrainingNotes, regions: visibleRegions(regions, user?.role === "ADMIN") };
}

// baca titik + kunci baris (FOR UPDATE) lalu cek kepemilikan
async function lockOwnedSpot(c: Parameters<typeof getEntity>[0], user: AuthUser, id: string) {
  const row = await getEntity<CulturalSpot>(c, "spot", id, true);
  if (!row || row.payload.status === "ARCHIVED") fail(404, "Titik lokasi tidak ditemukan.");
  if (user.role !== "ADMIN" && row.owner_id !== user.id) fail(403, "Ini bukan lapak Anda.", "NOT_YOUR_SPOT");
  return row;
}

export default async function spotRoutes(app: FastifyInstance) {
  app.get("/api/spots", async (request) => {
    const q = request.query as { vibe?: string; regionId?: string };
    return snapshot(currentUser(request), { vibe: q.vibe, regionId: q.regionId });
  });

  // POST /api/spots: field disaring satu2 (dulu body mitra diterima mentah: XP misi, kapasitas, status, sumber terverifikasi)
  app.post("/api/spots", async (request, reply) => {
    const user = requireRoles(request, ["MERCHANT", "ADMIN"]);
    const b = bodyOf(request);
    const isAdmin = user.role === "ADMIN";
    const name = str(b.name, 80);
    if (name.length < 3) bad("Nama titik minimal 3 karakter.");
    const coordinates = coordsOf(b.coordinates);
    const spotType = b.spotType as CulturalSpot["spotType"];
    if (!SPOT_TYPES.includes(spotType)) bad("Jenis titik tidak valid.");
    if (!isAdmin && spotType === "PRIMARY_DEST") fail(403, "Hanya pengelola yang boleh menambah cagar budaya utama.", "FORBIDDEN");
    const opkCategory = b.opkCategory as CulturalSpot["opkCategory"];
    if (!OPK_VALUES.includes(opkCategory)) bad("Kategori OPK tidak valid.");
    const address = str(b.address, 200);
    if (address.length < 5) bad("Alamat terlalu pendek.");
    const q = (b.quest ?? {}) as Record<string, unknown>;
    const vr = (q.voucherReward ?? {}) as Record<string, unknown>;
    const { disc, min } = moneyOf(vr.discountAmount, vr.minimumSpend);
    const target = str(q.targetObjectPrompt, 200);
    if (!target) bad("Tulis objek yang harus dipindai wisatawan.");
    const cap = Number((b.quota as { maxCapacity?: unknown } | undefined)?.maxCapacity);
    if (!Number.isInteger(cap) || cap < 1 || cap > capMaxFor(user)) bad(`Kapasitas 1 sampai ${capMaxFor(user).toLocaleString("id-ID")} orang.`);
    const xp = Number(q.rewardPoints);

    const regions = await listRegions(pool);
    const region = regionFor(coordinates, regions);
    if (!region && isAdmin) fail(400, "Lokasi ini di luar semua kawasan. Buat atau perluas kawasan dulu di tab Kawasan.", "OUT_OF_REGION");
    const nearest = region ?? [...regions].sort((a, z) => distanceMeters(coordinates, a.center) - distanceMeters(coordinates, z.center))[0];

    const spot: CulturalSpot = {
      id: newId("spot"),
      ownerId: isAdmin ? undefined : user.id,
      createdAt: new Date().toISOString(),
      status: isAdmin ? "PUBLISHED" : "PENDING_REVIEW",
      name,
      regionName: region ? `${region.name}, ${region.label}` : "Di luar kawasan",
      regionId: region?.id,
      regionProposal: region ? undefined : str(b.regionProposal, 80) || undefined,
      vibe: nearest?.theme ?? "majapahit",
      spotType,
      opkCategory,
      coordinates,
      address,
      facilities: b.facilities === undefined ? [] : facilitiesOf(b.facilities),
      highlight: highlightOf(b.highlight),
      entry: b.entry ? parsedOr(parseEntry(b.entry)) : undefined,
      openingHours: b.openingHours ? parsedOr(parseHours(b.openingHours)) : undefined,
      // acara bertanggal (festival) cuma dr pengelola
      event: isAdmin && b.event ? parsedOr(parseEvent(b.event)) : undefined,
      quota: { currentVisitors: 0, maxCapacity: cap, estimatedWaitMinutes: 0, nextAvailableSlot: "Tersedia langsung" },
      quest: {
        riddleTitle: str(q.riddleTitle, 80) || `Misi ${name}`,
        riddleClue: str(q.riddleClue, 300),
        targetObjectPrompt: target,
        // sumber terverifikasi cuma dr pengelola
        verifiedLoreSource: isAdmin ? str(q.verifiedLoreSource, 160) || "Pengelola LOKAWIRA" : "Keterangan mitra (belum diverifikasi pengelola)",
        loreNarrative: str(q.loreNarrative, 1500),
        // XP misi cuma diatur pengelola, mitra dapat 100
        rewardPoints: isAdmin && Number.isFinite(xp) ? Math.max(0, Math.min(1000, Math.round(xp))) : 100,
        voucherReward: { merchantName: name, discountTitle: str(vr.discountTitle, 80) || `Potongan di ${name}`, discountAmount: disc, minimumSpend: min },
        referenceImages: [],
      },
    };
    for (const k of Object.keys(spot) as (keyof CulturalSpot)[]) if (spot[k] === undefined) delete spot[k];
    await saveEntity(pool, "spot", spot.id, spot, spot.ownerId ?? null);
    return reply.code(201).send({ spot, spots: await visibleSpots(pool, user) });
  });

  // PATCH /api/spots/:id: atomik (baris dikunci, semua dicek dulu baru disimpan). Field sensitif cuma pengelola
  app.patch<{ Params: { id: string } }>("/api/spots/:id", async (request) => {
    const user = requireRoles(request, ["MERCHANT", "ADMIN"]);
    const b = bodyOf(request);
    const isAdmin = user.role === "ADMIN";
    const spot = await tx(async (c) => {
      const row = await lockOwnedSpot(c, user, request.params.id);
      const draft = structuredClone(row.payload);
      const before = { name: draft.name, lat: draft.coordinates.lat, lng: draft.coordinates.lng };
      if (b.name !== undefined) {
        const name = str(b.name, 80);
        if (name.length < 3) bad("Nama minimal 3 karakter.");
        draft.name = name;
        draft.quest.voucherReward.merchantName = name;
      }
      if (b.address !== undefined) {
        const a = str(b.address, 200);
        if (a.length < 5) bad("Alamat terlalu pendek.");
        draft.address = a;
      }
      if (b.facilities !== undefined) draft.facilities = facilitiesOf(b.facilities);
      if (b.coordinates !== undefined) {
        draft.coordinates = coordsOf(b.coordinates);
        const region = regionFor(draft.coordinates, await listRegions(c));
        if (!region && isAdmin) fail(400, "Lokasi baru di luar semua kawasan. Buat atau perluas kawasan dulu.", "OUT_OF_REGION");
        applyRegion(draft, region);
        if (!region) draft.regionName = "Di luar kawasan";
      }
      const quota = b.quota as { maxCapacity?: unknown } | undefined;
      if (quota?.maxCapacity !== undefined) {
        const cap = Number(quota.maxCapacity);
        if (!Number.isInteger(cap) || cap < 1 || cap > capMaxFor(user)) bad(`Kapasitas 1 sampai ${capMaxFor(user).toLocaleString("id-ID")} orang.`);
        draft.quota.maxCapacity = cap;
        draft.quota.currentVisitors = Math.min(draft.quota.currentVisitors, cap);
        draft.quota.estimatedWaitMinutes = estimatedWait(draft.quota.currentVisitors, cap);
      }
      const q = b.quest as Record<string, unknown> | undefined;
      if (q && typeof q === "object") {
        if (q.riddleTitle !== undefined) draft.quest.riddleTitle = str(q.riddleTitle, 80);
        if (q.riddleClue !== undefined) {
          const clue = str(q.riddleClue, 300);
          if (clue.length < 10) bad("Petunjuk misi minimal 10 karakter.");
          draft.quest.riddleClue = clue;
        }
        if (q.loreNarrative !== undefined) draft.quest.loreNarrative = str(q.loreNarrative, 1500);
        if (q.targetObjectPrompt !== undefined) {
          const t = str(q.targetObjectPrompt, 200);
          if (!t) bad("Tulis objek yang harus dipindai wisatawan.");
          draft.quest.targetObjectPrompt = t;
        }
        if (isAdmin && q.verifiedLoreSource !== undefined) draft.quest.verifiedLoreSource = str(q.verifiedLoreSource, 160);
        if (isAdmin && q.rewardPoints !== undefined) {
          const xp = Number(q.rewardPoints);
          if (!Number.isFinite(xp) || xp < 0 || xp > 1000) bad("Poin hadiah harus 0 sampai 1.000.");
          draft.quest.rewardPoints = Math.round(xp);
        }
      }
      if (b.highlight !== undefined) {
        const h = highlightOf(b.highlight);
        if (h) draft.highlight = h;
        else delete draft.highlight;
      }
      if (b.entry !== undefined) {
        if (b.entry === null) delete draft.entry;
        else draft.entry = parsedOr(parseEntry(b.entry));
      }
      if (b.openingHours !== undefined) {
        if (b.openingHours === null) delete draft.openingHours;
        else draft.openingHours = parsedOr(parseHours(b.openingHours));
      }
      if (isAdmin) {
        if (b.spotType !== undefined) {
          if (!SPOT_TYPES.includes(b.spotType as CulturalSpot["spotType"])) bad("Jenis titik tidak valid.");
          draft.spotType = b.spotType as CulturalSpot["spotType"];
        }
        if (b.opkCategory !== undefined) {
          if (!OPK_VALUES.includes(b.opkCategory as CulturalSpot["opkCategory"])) bad("Kategori OPK tidak valid.");
          draft.opkCategory = b.opkCategory as CulturalSpot["opkCategory"];
        }
        if (b.event !== undefined) {
          if (b.event === null) delete draft.event;
          else draft.event = parsedOr(parseEvent(b.event));
        }
      }
      // mitra ngubah nama/lokasi: balik ditinjau pengelola
      const moved = draft.coordinates.lat !== before.lat || draft.coordinates.lng !== before.lng;
      if (!isAdmin && (draft.name !== before.name || moved)) draft.status = "PENDING_REVIEW";
      await saveEntity(c, "spot", row.id, draft, row.owner_id);
      return draft;
    });
    return { spot, spots: await visibleSpots(pool, user) };
  });

  app.delete<{ Params: { id: string } }>("/api/spots/:id", async (request) => {
    const user = requireRoles(request, ["MERCHANT", "ADMIN"], { allowInactiveMerchant: true });
    await tx(async (c) => {
      const row = await lockOwnedSpot(c, user, request.params.id);
      if (row.payload.spotType === "PRIMARY_DEST" && user.role !== "ADMIN") fail(403, "Cagar budaya utama hanya bisa diarsipkan pengelola.", "FORBIDDEN");
      row.payload.status = "ARCHIVED";
      await saveEntity(c, "spot", row.id, row.payload, row.owner_id);
    });
    return { spots: await visibleSpots(pool, user) };
  });

  app.patch<{ Params: { id: string } }>("/api/spots/:id/quota", async (request) => {
    const user = requireRoles(request, ["ADMIN"]);
    const n = Number(bodyOf(request).currentVisitors);
    if (!Number.isFinite(n)) bad("Jumlah pengunjung tidak valid.");
    const spot = await tx(async (c) => {
      const row = await lockOwnedSpot(c, user, request.params.id);
      const s = row.payload;
      s.quota.currentVisitors = Math.max(0, Math.min(s.quota.maxCapacity, Math.round(n)));
      s.quota.estimatedWaitMinutes = estimatedWait(s.quota.currentVisitors, s.quota.maxCapacity);
      await saveEntity(c, "spot", row.id, s, row.owner_id);
      return s;
    });
    return { spot, spots: await visibleSpots(pool, user) };
  });

  app.put<{ Params: { id: string } }>("/api/spots/:id/promo", async (request) => {
    const user = requireRoles(request, ["MERCHANT", "ADMIN"]);
    const b = bodyOf(request);
    const title = str(b.discountTitle, 80);
    if (!title) bad("Judul promo wajib diisi.");
    const { disc, min } = moneyOf(b.discountAmount, b.minimumSpend);
    const spot = await tx(async (c) => {
      const row = await lockOwnedSpot(c, user, request.params.id);
      const s = row.payload;
      s.quest.voucherReward = { ...s.quest.voucherReward, discountTitle: title, discountAmount: disc, minimumSpend: min };
      // Hany penglola yg bole mengubah XP misi (ekonomi gamifikasi).
      if (user.role === "ADMIN" && b.rewardPoints !== undefined) {
        const xp = Number(b.rewardPoints);
        if (!Number.isFinite(xp) || xp < 0 || xp > 1000) bad("Poin hadiah harus 0 sampai 1.000.");
        s.quest.rewardPoints = Math.round(xp);
      }
      await saveEntity(c, "spot", row.id, s, row.owner_id);
      return s;
    });
    return { spot, spots: await visibleSpots(pool, user) };
  });

  // foto contoh objek (dipake AI sbg pembanding). Disimpan bytea, maks 5 per titik
  app.post<{ Params: { id: string } }>("/api/spots/:id/reference-images", async (request) => {
    const user = requireRoles(request, ["MERCHANT", "ADMIN"]);
    const pre = await getEntity<CulturalSpot>(pool, "spot", request.params.id);
    if (!pre || pre.payload.status === "ARCHIVED") fail(404, "Titik lokasi tidak ditemukan.");
    if (user.role !== "ADMIN" && pre.owner_id !== user.id) fail(403, "Ini bukan lapak Anda.", "NOT_YOUR_SPOT");
    let part;
    try {
      part = await request.file();
    } catch {
      fail(413, "Foto lebih dari 5 MB.", "IMAGE_TOO_LARGE");
    }
    if (!part || part.fieldname !== "image") bad("Kirim foto pada field image.");
    if (!IMAGE_TYPES.has(part.mimetype)) fail(415, "Format foto harus JPEG, PNG, atau WebP.", "IMAGE_TYPE_UNSUPPORTED");
    let data: Buffer;
    try {
      data = await part.toBuffer();
    } catch {
      fail(413, "Foto lebih dari 5 MB.", "IMAGE_TOO_LARGE");
    }
    if (data.length > MAX_IMAGE_BYTES) fail(413, "Foto lebih dari 5 MB.", "IMAGE_TOO_LARGE");
    if (!imageSignatureMatches(part.mimetype, data)) fail(415, "Isi foto tidak sesuai dengan format berkasnya.", "IMAGE_TYPE_UNSUPPORTED");
    const referenceImages = await tx(async (c) => {
      const row = await lockOwnedSpot(c, user, request.params.id);
      const list = row.payload.quest.referenceImages ?? [];
      if (list.length >= MAX_IMAGES) fail(409, `Maksimal ${MAX_IMAGES} foto contoh per lapak. Hapus satu dulu.`, "TOO_MANY_IMAGES");
      const imageId = newId("img");
      list.push({ id: imageId, url: `/api/spots/${encodeURIComponent(row.id)}/reference-images/${encodeURIComponent(imageId)}` });
      row.payload.quest.referenceImages = list;
      await c.query("INSERT INTO entities(id,kind,owner_id,payload,file_data,mime_type) VALUES($1,'reference-image',$2,$3,$4,$5)", [imageId, row.id, JSON.stringify({ spotId: row.id }), data, part.mimetype]);
      await saveEntity(c, "spot", row.id, row.payload, row.owner_id);
      return list;
    });
    return { referenceImages };
  });

  app.get<{ Params: { id: string; imageId: string } }>("/api/spots/:id/reference-images/:imageId", async (request, reply) => {
    const r = await pool.query<{ file_data: Buffer; mime_type: string }>("SELECT file_data,mime_type FROM entities WHERE kind='reference-image' AND id=$1 AND owner_id=$2", [request.params.imageId, request.params.id]);
    if (!r.rows[0]) fail(404, "Foto contoh tidak ditemukan.");
    return reply.type(r.rows[0].mime_type).header("Cache-Control", "public, max-age=86400").header("X-Content-Type-Options", "nosniff").send(r.rows[0].file_data);
  });

  app.delete<{ Params: { id: string; imageId: string } }>("/api/spots/:id/reference-images/:imageId", async (request) => {
    const user = requireRoles(request, ["MERCHANT", "ADMIN"]);
    const referenceImages = await tx(async (c) => {
      const row = await lockOwnedSpot(c, user, request.params.id);
      const del = await c.query("DELETE FROM entities WHERE kind='reference-image' AND id=$1 AND owner_id=$2", [request.params.imageId, row.id]);
      if (!del.rowCount) fail(404, "Foto contoh tidak ditemukan.");
      row.payload.quest.referenceImages = (row.payload.quest.referenceImages ?? []).filter((i) => i.id !== request.params.imageId);
      await saveEntity(c, "spot", row.id, row.payload, row.owner_id);
      return row.payload.quest.referenceImages;
    });
    return { referenceImages };
  });
}
