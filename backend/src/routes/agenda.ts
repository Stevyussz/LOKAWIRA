import type { FastifyInstance } from "fastify";
import type { CulturalEvent, CulturalSpot, EventOccurrence, EventRepeat, IssuedVoucher, MetricType, Region, SpotImpact } from "../../../src/types/lokawira";
import { occurrences } from "../../../src/lib/eventRules";
import { tzOf } from "../../../src/lib/spotRules";
import { parseRegion } from "../../../src/lib/server/regionInput";
import { pool, tx, type Db } from "../db.js";
import {
  applyRegion, bad, fail, findVisibleSpot, getEntity, listEntities, listRegions, newId, rateLimit, regionFor, saveEntity, sha, visibleRegions, visibleSpots,
} from "../core.js";
import { bodyOf, currentUser, requireRoles } from "../http.js";
import type { AuthUser } from "../../../src/types/lokawira";

const METRIC_TYPES: MetricType[] = ["QR_OPEN", "REMINDER_SAVED", "GUIDE_START"];
const REPEATS: EventRepeat[] = ["NONE", "WEEKLY", "MONTHLY_LAST"];

// lapak yatim (di luar kawasan) yg sekarang masuk radius kawasan langsung ikut. Balikin jumlahnya
async function adoptOrphans(c: Db) {
  const regions = await listRegions(c);
  const rows = await c.query<{ id: string; owner_id: string | null; payload: CulturalSpot }>(
    "SELECT id,owner_id,payload FROM entities WHERE kind='spot' AND payload->>'regionId' IS NULL AND payload->>'status' IS DISTINCT FROM 'ARCHIVED' FOR UPDATE"
  );
  let n = 0;
  for (const row of rows.rows) {
    const r = regionFor(row.payload.coordinates, regions);
    if (!r) continue;
    applyRegion(row.payload, r);
    await saveEntity(c, "spot", row.id, row.payload, row.owner_id);
    n++;
  }
  return n;
}

async function eventsManagedBy(user: AuthUser) {
  const all = await listEntities<CulturalEvent>(pool, "event");
  if (user.role === "ADMIN") return all.map((x) => x.payload);
  const own = await pool.query<{ id: string }>("SELECT id FROM entities WHERE kind='spot' AND owner_id=$1", [user.id]);
  const ids = new Set(own.rows.map((x) => x.id));
  return all.map((x) => x.payload).filter((e) => ids.has(e.spotId));
}

export default async function agendaRoutes(app: FastifyInstance) {
  // ---- kawasan: publik liat yg AKTIF, pengelola semua
  app.get("/api/regions", async (request) => ({ regions: visibleRegions(await listRegions(pool), currentUser(request)?.role === "ADMIN") }));

  app.post("/api/regions", async (request, reply) => {
    requireRoles(request, ["ADMIN"]);
    const parsed = parseRegion(bodyOf(request), {}, false);
    if (typeof parsed === "string") bad(parsed as string);
    const out = await tx(async (c) => {
      await c.query("SELECT pg_advisory_xact_lock(hashtext('regions'))");
      const regions = await listRegions(c);
      const data = parsed as Region;
      if (regions.some((r) => r.name.toLowerCase() === data.name.toLowerCase())) fail(409, "Nama kawasan sudah dipakai.", "REGION_NAME_TAKEN");
      const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "kawasan";
      let id = `rgn-${slug}`;
      for (let i = 2; regions.some((r) => r.id === id); i++) id = `rgn-${slug}-${i}`;
      const region: Region = { ...data, id, createdAt: new Date().toISOString() };
      await saveEntity(c, "region", id, region);
      const adopted = await adoptOrphans(c);
      return { region, regions: await listRegions(c), adopted };
    });
    return reply.code(201).send(out);
  });

  app.patch<{ Params: { id: string } }>("/api/regions/:id", async (request) => {
    requireRoles(request, ["ADMIN"]);
    return tx(async (c) => {
      await c.query("SELECT pg_advisory_xact_lock(hashtext('regions'))");
      const row = await getEntity<Region>(c, "region", request.params.id, true);
      if (!row) fail(404, "Kawasan tidak ditemukan.");
      const parsed = parseRegion(bodyOf(request), row.payload, true);
      if (typeof parsed === "string") bad(parsed as string);
      const data = parsed as Region;
      const regions = await listRegions(c);
      if (regions.some((r) => r.id !== row.id && r.name.toLowerCase() === data.name.toLowerCase())) fail(409, "Nama kawasan sudah dipakai.", "REGION_NAME_TAKEN");
      const region: Region = { ...data, id: row.id, createdAt: row.payload.createdAt };
      await saveEntity(c, "region", row.id, region);
      // titik di kawasan ini ngikut nama & palet barunya
      await c.query(
        "UPDATE entities SET payload = payload || jsonb_build_object('vibe',$2::text,'regionName',$3::text) WHERE kind='spot' AND payload->>'regionId'=$1",
        [row.id, region.theme, `${region.name}, ${region.label}`]
      );
      const adopted = await adoptOrphans(c);
      return { region, regions: await listRegions(c), adopted };
    });
  });

  // ---- acara: occurrences = kemunculan s.d. N hari ke depan di titik yg keliatan; events = yg boleh dia kelola
  app.get("/api/events", async (request) => {
    const user = currentUser(request);
    const q = request.query as { days?: string; regionId?: string; spotId?: string };
    const days = Math.max(1, Math.min(90, Number(q.days) || 30));
    const spots = new Map((await visibleSpots(pool, user)).map((s) => [s.id, s]));
    const from = new Date();
    const to = new Date(from.getTime() + days * 86400000);
    const list: EventOccurrence[] = [];
    for (const { payload: ev } of await listEntities<CulturalEvent>(pool, "event")) {
      const s = spots.get(ev.spotId);
      if (!s || (q.regionId && s.regionId !== q.regionId) || (q.spotId && s.id !== q.spotId)) continue;
      for (const o of occurrences(ev, from, to, tzOf(s))) {
        list.push({ eventId: ev.id, spotId: s.id, spotName: s.name, regionId: s.regionId, title: ev.title, description: ev.description, repeat: ev.repeat, ...o });
      }
    }
    list.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    const manage = user && (user.role === "ADMIN" || (user.role === "MERCHANT" && user.status === "ACTIVE")) ? await eventsManagedBy(user) : undefined;
    return { occurrences: list.slice(0, 200), events: manage };
  });

  app.post("/api/events", async (request, reply) => {
    const user = requireRoles(request, ["MERCHANT", "ADMIN"]);
    const b = bodyOf(request);
    const spotId = String(b.spotId ?? "");
    const title = String(b.title ?? "").trim();
    if (title.length < 3 || title.length > 80) bad("Judul acara 3 sampai 80 karakter.");
    const description = String(b.description ?? "").trim();
    if (description.length > 300) bad("Keterangan acara maksimal 300 karakter.");
    const repeat = String(b.repeat ?? "NONE") as EventRepeat;
    if (!REPEATS.includes(repeat)) bad("Pola ulang tidak valid.");
    const s = new Date(String(b.startsAt ?? "")).getTime();
    const e = new Date(String(b.endsAt ?? "")).getTime();
    if (!Number.isFinite(s) || !Number.isFinite(e)) bad("Isi tanggal dan jam acara.");
    if (e <= s) bad("Waktu selesai harus setelah waktu mulai.");
    if (e - s > 12 * 3600000) bad("Satu acara maksimal 12 jam. Untuk tempat yang buka tiap hari, pakai jam buka.");
    if (repeat === "NONE" && e < Date.now()) bad("Acara ini sudah lewat.");
    if (s > Date.now() + 366 * 86400000) bad("Acara maksimal setahun ke depan.");
    const ev = await tx(async (c) => {
      const spot = await getEntity<CulturalSpot>(c, "spot", spotId, true);
      if (!spot || spot.payload.status === "ARCHIVED") fail(404, "Titik lokasi tidak ditemukan.");
      if (user.role !== "ADMIN" && spot.owner_id !== user.id) fail(403, "Ini bukan lapak Anda.", "NOT_YOUR_SPOT");
      const count = await c.query<{ n: string }>("SELECT count(*) AS n FROM entities WHERE kind='event' AND payload->>'spotId'=$1", [spotId]);
      if (Number(count.rows[0].n) >= 20) fail(409, "Maksimal 20 acara per titik. Hapus acara lama dulu.", "TOO_MANY_EVENTS");
      const event: CulturalEvent = {
        id: newId("evt"),
        spotId,
        title,
        ...(description ? { description } : {}),
        startsAt: new Date(s).toISOString(),
        endsAt: new Date(e).toISOString(),
        repeat,
        createdAt: new Date().toISOString(),
      };
      await saveEntity(c, "event", event.id, event, spot.owner_id);
      return event;
    });
    return reply.code(201).send({ event: ev, events: await eventsManagedBy(user) });
  });

  app.delete<{ Params: { id: string } }>("/api/events/:id", async (request) => {
    const user = requireRoles(request, ["MERCHANT", "ADMIN"]);
    const ev = await getEntity<CulturalEvent>(pool, "event", request.params.id);
    if (!ev) fail(404, "Acara tidak ditemukan.");
    const spot = await getEntity<CulturalSpot>(pool, "spot", ev.payload.spotId);
    if (user.role !== "ADMIN" && spot?.owner_id !== user.id) fail(403, "Ini bukan acara di lapak Anda.", "NOT_YOUR_SPOT");
    await pool.query("DELETE FROM entities WHERE kind='event' AND id=$1", [ev.id]);
    return { events: await eventsManagedBy(user) };
  });

  // ---- dampak anonim: cuma jenis, titik, waktu (UU PDP). Dibatasi per IP biar angka gak bisa digelembungkan
  app.post("/api/metrics", async (request, reply) => {
    const b = bodyOf(request);
    if (!METRIC_TYPES.includes(b.type as MetricType)) bad("Jenis catatan tidak valid.");
    const row = await findVisibleSpot(pool, currentUser(request), b.spotId);
    if (!row) fail(404, "Titik lokasi tidak ditemukan.");
    // maks 30x per jenis/titik/IP per jam: cukup longgar buat banyak HP di balik satu NAT, tapi angka gak bisa digelembungkan skrip
    const fresh = await rateLimitSoft(`metric:${b.type}:${row.id}:${sha(request.ip)}`, 30, 3600);
    if (fresh) await pool.query("INSERT INTO metrics(type,spot_id) VALUES($1,$2)", [b.type, row.id]);
    return reply.code(202).send({ ok: true });
  });

  app.get("/api/metrics", async (request) => {
    const user = requireRoles(request, ["MERCHANT", "ADMIN"]);
    const q = request.query as { days?: string; regionId?: string };
    const days = Math.max(1, Math.min(365, Number(q.days) || 30));
    const since = new Date(Date.now() - days * 86400000);
    const sinceIso = since.toISOString();
    const spotsQ = await pool.query<{ id: string; payload: CulturalSpot }>(
      "SELECT id,payload FROM entities WHERE kind='spot' AND payload->>'status' IS DISTINCT FROM 'ARCHIVED' AND ($1::text IS NULL OR owner_id=$1) AND ($2::text IS NULL OR payload->>'regionId'=$2)",
      [user.role === "ADMIN" ? null : user.id, q.regionId || null]
    );
    const ids = spotsQ.rows.map((r) => r.id);
    const [m, ci, vouchers, events] = await Promise.all([
      pool.query<{ spot_id: string; type: MetricType; n: string }>("SELECT spot_id,type,count(*) AS n FROM metrics WHERE spot_id = ANY($1) AND at >= $2 GROUP BY spot_id,type", [ids, since]),
      pool.query<{ spot: string; total: string; verified: string }>(
        "SELECT payload->>'spotId' AS spot, count(*) AS total, count(*) FILTER (WHERE (payload->>'verified')::boolean) AS verified FROM entities WHERE kind='checkin' AND payload->>'spotId' = ANY($1) AND created_at >= $2 GROUP BY 1",
        [ids, since]
      ),
      pool.query<{ payload: IssuedVoucher; created_at: Date }>("SELECT payload,created_at FROM entities WHERE kind='voucher' AND payload->>'spotId' = ANY($1)", [ids]),
      pool.query<{ payload: CulturalEvent }>("SELECT payload FROM entities WHERE kind='event' AND payload->>'spotId' = ANY($1)", [ids]),
    ]);
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 86400000);
    const rows: SpotImpact[] = spotsQ.rows.map(({ id, payload: s }) => {
      const metric = (t: MetricType) => Number(m.rows.find((x) => x.spot_id === id && x.type === t)?.n ?? 0);
      const c = ci.rows.find((x) => x.spot === id);
      const mine = vouchers.rows.filter((v) => v.payload.spotId === id);
      const redeemed = mine.filter((v) => v.payload.status === "REDEEMED" && (v.payload.redeemedAt ?? "") >= sinceIso);
      return {
        spotId: id,
        spotName: s.name,
        regionId: s.regionId,
        qrOpens: metric("QR_OPEN"),
        reminders: metric("REMINDER_SAVED"),
        guides: metric("GUIDE_START"),
        checkIns: Number(c?.total ?? 0),
        checkInsVerified: Number(c?.verified ?? 0),
        vouchersIssued: mine.filter((v) => (v.payload.issuedAt ?? v.created_at.toISOString()) >= sinceIso).length,
        vouchersRedeemed: redeemed.length,
        redeemedValue: redeemed.reduce((a, v) => a + v.payload.discountAmount, 0),
        upcomingEvents: events.rows.filter((e) => e.payload.spotId === id).reduce((a, e) => a + occurrences(e.payload, now, in30, tzOf(s)).length, 0),
      };
    });
    const sum = (k: keyof Omit<SpotImpact, "spotId" | "spotName" | "regionId">) => rows.reduce((a, r) => a + r[k], 0);
    return {
      days,
      totals: {
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
      },
      spots: rows.sort((a, b) => b.checkIns + b.qrOpens - (a.checkIns + a.qrOpens)),
    };
  });
}

// versi limiter yg gak ngelempar galat: true = masih dlm batas
async function rateLimitSoft(key: string, limit: number, windowSeconds: number) {
  try {
    await rateLimit(pool, key, limit, windowSeconds, "");
    return true;
  } catch {
    return false;
  }
}

export { findVisibleSpot };
