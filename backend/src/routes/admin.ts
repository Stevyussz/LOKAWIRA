import type { FastifyInstance, FastifyRequest } from "fastify";
import type { CulturalSpot, IssuedVoucher, ReservationPass } from "../../../src/types/lokawira";
import { pool, tx } from "../db.js";
import { bad, fail, getEntity, saveEntity, visibleSpots } from "../core.js";
import { bodyOf, requireRoles, type UserRow } from "../http.js";

type MerchantRow = Pick<UserRow, "id" | "name" | "email" | "status" | "status_reason" | "created_at"> & { spot_count?: number };

function toMerchantDto(u: MerchantRow, spotCount: number) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    status: u.status ?? "ACTIVE",
    ...(u.status_reason ? { statusReason: u.status_reason } : {}),
    createdAt: new Date(u.created_at).toISOString(),
    spotCount,
  };
}

async function merchantSummary(u: MerchantRow) {
  const r = await pool.query<{ count: string }>("SELECT count(*) FROM entities WHERE kind='spot' AND owner_id=$1 AND payload->>'status' IS DISTINCT FROM 'ARCHIVED'", [u.id]);
  return toMerchantDto(u, Number(r.rows[0].count));
}

function pageParams(request: FastifyRequest, def = 20) {
  const q = request.query as { limit?: string; cursor?: string };
  const limit = Math.max(1, Math.min(100, Number(q.limit) || def));
  const off = q.cursor ? Math.max(0, Number(Buffer.from(q.cursor, "base64url").toString()) || 0) : 0;
  return { limit, off };
}

function encodeCursor(rows: unknown[], limit: number, off: number) {
  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  return {
    slice,
    ...(hasMore ? { nextCursor: Buffer.from(String(off + slice.length)).toString("base64url") } : {}),
  };
}

export default async function adminRoutes(app: FastifyInstance) {
  app.get("/api/admin/merchants", async (request) => {
    requireRoles(request, ["ADMIN"]);
    const status = (request.query as { status?: string }).status || null;
    const { limit, off } = pageParams(request, 20);
    const r = await pool.query<MerchantRow>(
      `SELECT u.id, u.name, u.email, u.status, u.status_reason, u.created_at,
              COUNT(e.id)::int AS spot_count
       FROM users u
       LEFT JOIN entities e
         ON e.kind = 'spot'
        AND e.owner_id = u.id
        AND e.payload->>'status' IS DISTINCT FROM 'ARCHIVED'
       WHERE u.role = 'MERCHANT'
         AND ($1::text IS NULL OR u.status = $1)
       GROUP BY u.id
       ORDER BY u.created_at DESC
       LIMIT $2 OFFSET $3`,
      [status, limit + 1, off]
    );
    const { slice, nextCursor } = encodeCursor(r.rows, limit, off);
    return {
      merchants: (slice as MerchantRow[]).map((m) => toMerchantDto(m, Number(m.spot_count ?? 0))),
      ...(nextCursor ? { nextCursor } : {}),
    };
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
    const { limit, off } = pageParams(request, 10);
    const r = await pool.query<{ payload: ReservationPass }>(
      `SELECT payload
       FROM entities
       WHERE kind = 'reservation'
         AND ($1::text IS NULL OR payload->>'spotId' = $1)
         AND ($2::text IS NULL OR payload->>'status' = $2)
         AND ($3::text IS NULL OR payload->>'createdAt' >= $3)
         AND ($4::text IS NULL OR payload->>'createdAt' <= $4)
       ORDER BY created_at DESC, id
       LIMIT $5 OFFSET $6`,
      [q.spotId || null, q.status || null, q.from || null, q.to || null, limit + 1, off]
    );
    const { slice, nextCursor } = encodeCursor(r.rows, limit, off);
    return { reservations: (slice as { payload: ReservationPass }[]).map((x) => x.payload), ...(nextCursor ? { nextCursor } : {}) };
  });
  app.get("/api/admin/vouchers", async (request) => {
    requireRoles(request, ["ADMIN"]);
    const q = request.query as { spotId?: string; status?: string };
    const { limit, off } = pageParams(request, 10);
    const r = await pool.query<{ payload: IssuedVoucher }>(
      `SELECT payload
       FROM entities
       WHERE kind = 'voucher'
         AND ($1::text IS NULL OR payload->>'spotId' = $1)
         AND ($2::text IS NULL OR payload->>'status' = $2)
       ORDER BY created_at DESC, id
       LIMIT $3 OFFSET $4`,
      [q.spotId || null, q.status || null, limit + 1, off]
    );
    const { slice, nextCursor } = encodeCursor(r.rows, limit, off);
    return { vouchers: (slice as { payload: IssuedVoucher }[]).map((x) => x.payload), ...(nextCursor ? { nextCursor } : {}) };
  });
}
