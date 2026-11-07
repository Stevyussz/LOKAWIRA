import type { FastifyInstance, FastifyRequest } from "fastify";
import type { CulturalSpot, IssuedVoucher, ReservationPass } from "../../../src/types/lokawira";
import { pool, tx } from "../db.js";
import { bad, fail, getEntity, listEntities, saveEntity, visibleSpots } from "../core.js";
import { bodyOf, requireRoles, type UserRow } from "../http.js";

type MerchantRow = Pick<UserRow, "id" | "name" | "email" | "status" | "status_reason" | "created_at">;

async function merchantSummary(u: MerchantRow) {
  const r = await pool.query<{ count: string }>("SELECT count(*) FROM entities WHERE kind='spot' AND owner_id=$1 AND payload->>'status' IS DISTINCT FROM 'ARCHIVED'", [u.id]);
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    status: u.status ?? "ACTIVE",
    ...(u.status_reason ? { statusReason: u.status_reason } : {}),
    createdAt: new Date(u.created_at).toISOString(),
    spotCount: Number(r.rows[0].count),
  };
}

// paginasi offset sederhana (cursor = offset base64url)
function page<T>(rows: T[], request: FastifyRequest, def = 20) {
  const q = request.query as { limit?: string; cursor?: string };
  const limit = Math.max(1, Math.min(100, Number(q.limit) || def));
  const off = q.cursor ? Number(Buffer.from(q.cursor, "base64url").toString()) || 0 : 0;
  const slice = rows.slice(off, off + limit);
  return { slice, ...(off + slice.length < rows.length ? { nextCursor: Buffer.from(String(off + slice.length)).toString("base64url") } : {}) };
}

export default async function adminRoutes(app: FastifyInstance) {
  app.get("/api/admin/merchants", async (request) => {
    requireRoles(request, ["ADMIN"]);
    const status = (request.query as { status?: string }).status || null;
    const r = await pool.query<MerchantRow>("SELECT id,name,email,status,status_reason,created_at FROM users WHERE role='MERCHANT' AND ($1::text IS NULL OR status=$1) ORDER BY created_at DESC", [status]);
    const { slice, nextCursor } = page(r.rows, request);
    return { merchants: await Promise.all(slice.map(merchantSummary)), ...(nextCursor ? { nextCursor } : {}) };
  });

  // setujui / tolak / nonaktifkan mitra. Lapak mitra nonaktif langsung ilang dr peta publik
  app.post<{ Params: { id: string } }>("/api/admin/merchants/:id/approve", async (request) => {
    requireRoles(request, ["ADMIN"]);
    const r = await pool.query<MerchantRow>("UPDATE users SET status='ACTIVE',status_reason=NULL WHERE id=$1 AND role='MERCHANT' RETURNING id,name,email,status,status_reason,created_at", [request.params.id]);
    if (!r.rows[0]) fail(404, "Mitra tidak ditemukan.");
    return { merchant: await merchantSummary(r.rows[0]) };
  });
  app.post<{ Params: { id: string } }>("/api/admin/merchants/:id/reject", async (request) => {
    requireRoles(request, ["ADMIN"]);
    const reason = String(bodyOf(request).reason ?? "").trim().slice(0, 200);
    const r = await pool.query<MerchantRow>("UPDATE users SET status='REJECTED',status_reason=$2 WHERE id=$1 AND role='MERCHANT' RETURNING id,name,email,status,status_reason,created_at", [request.params.id, reason || null]);
    if (!r.rows[0]) fail(404, "Mitra tidak ditemukan.");
    return { merchant: await merchantSummary(r.rows[0]) };
  });

  app.post<{ Params: { id: string } }>("/api/admin/spots/:id/review", async (request) => {
    const user = requireRoles(request, ["ADMIN"]);
    const b = bodyOf(request);
    if (b.decision !== "PUBLISH" && b.decision !== "REJECT") bad("Keputusan tidak valid.");
    const spot = await tx(async (c) => {
      const row = await getEntity<CulturalSpot>(c, "spot", request.params.id, true);
      if (!row || row.payload.status === "ARCHIVED") fail(404, "Titik lokasi tidak ditemukan.");
      // titik di luar semua kawasan gak bisa terbit (gak bakal keliatan siapa pun)
      if (b.decision === "PUBLISH" && !row.payload.regionId) fail(409, "Titik ini di luar semua kawasan. Buat atau perluas kawasan yang mencakupnya dulu.", "NO_REGION");
      row.payload.status = b.decision === "PUBLISH" ? "PUBLISHED" : "REJECTED";
      if (b.decision === "REJECT") {
        const reason = String(b.reason ?? "").trim().slice(0, 200);
        if (reason) row.payload.statusReason = reason;
        else delete row.payload.statusReason;
      } else delete row.payload.statusReason;
      await saveEntity(c, "spot", row.id, row.payload, row.owner_id);
      return row.payload;
    });
    return { spot, spots: await visibleSpots(pool, user) };
  });

  app.get("/api/admin/reservations", async (request) => {
    requireRoles(request, ["ADMIN"]);
    const q = request.query as { spotId?: string; status?: string; from?: string; to?: string };
    const rows = (await listEntities<ReservationPass>(pool, "reservation"))
      .map((x) => x.payload)
      .filter((r) => (!q.spotId || r.spotId === q.spotId) && (!q.status || r.status === q.status) && (!q.from || r.createdAt >= q.from) && (!q.to || r.createdAt <= q.to));
    const { slice, nextCursor } = page(rows, request, 10);
    return { reservations: slice, ...(nextCursor ? { nextCursor } : {}) };
  });
  app.get("/api/admin/vouchers", async (request) => {
    requireRoles(request, ["ADMIN"]);
    const q = request.query as { spotId?: string; status?: string };
    const rows = (await listEntities<IssuedVoucher>(pool, "voucher")).map((x) => x.payload).filter((v) => (!q.spotId || v.spotId === q.spotId) && (!q.status || v.status === q.status));
    const { slice, nextCursor } = page(rows, request, 10);
    return { vouchers: slice, ...(nextCursor ? { nextCursor } : {}) };
  });
}
