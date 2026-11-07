import type { FastifyInstance } from "fastify";
import type { CulturalSpot, IssuedVoucher, ReservationPass } from "../../../src/types/lokawira";
import { distanceMeters } from "../../../src/lib/geo";
import { needsBooking, openState } from "../../../src/lib/spotRules";
import { pool, tx } from "../db.js";
import {
  addXp, bad, claimOnce, endOfWibDay, fail, findVisibleSpot, getEntity, isExpiredIso, listEntities, newId, ownedSpotIds, rateLimit, sha,
  uniqueCode, voucherSignature, wibDay,
} from "../core.js";
import { bodyOf, currentUser, requireRoles } from "../http.js";
import { geofence, GEOFENCE_ON } from "../geofence.js";
import { myRecords } from "./auth.js";

const MAX_SPEED_MS = 40; // ~144 km/j, perpindahan antar titik yg mustahil

// tutup / acara belum mulai / selesai: hadiah & bukti hadir gak sah
export function assertOpen(spot: CulturalSpot) {
  const os = openState(spot);
  if (os.status === "CLOSED" || os.status === "UPCOMING" || os.status === "ENDED") fail(409, `${spot.name} sedang tidak buka. ${os.label}.`, "CLOSED_NOW");
}

export default async function economyRoutes(app: FastifyInstance) {
  // check-in: server yg nentuin XP & nerbitin kode KDR. Satu per titik per hari WIB per akun (atau per IP utk tamu)
  app.post("/api/checkins", async (request) => {
    const b = bodyOf(request);
    const user = currentUser(request);
    const row = await findVisibleSpot(pool, user, b.spotId);
    if (!row) fail(404, "Titik lokasi tidak ditemukan.");
    const spot = row.payload;
    geofence(b, spot, "check-in");
    assertOpen(spot);
    const visitorKey = user?.id ?? `guest:${sha(request.ip)}`;
    if (!user) await rateLimit(pool, `checkin:${visitorKey}`, 30, 3600, "Terlalu banyak check-in dari jaringan ini. Coba lagi nanti.");
    const out = await tx(async (c) => {
      await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`checkin:${visitorKey}`]);
      const recent = await c.query<{ payload: { spotId: string; createdAt: string } }>(
        "SELECT payload FROM entities WHERE kind='checkin' AND owner_id=$1 ORDER BY created_at DESC LIMIT 50",
        [visitorKey]
      );
      const today = wibDay();
      if (recent.rows.some((x) => x.payload.spotId === spot.id && wibDay(new Date(x.payload.createdAt)) === today)) {
        fail(409, "Kamu sudah check-in di titik ini hari ini.", "ALREADY_CHECKED_IN_TODAY");
      }
      // cek kecepatan mustahil butuh koordinat asli, jadi cuma pas geofence nyala
      const last = recent.rows[0]?.payload;
      if (GEOFENCE_ON && last) {
        const dt = (Date.now() - Date.parse(last.createdAt)) / 1000;
        const prev = dt < 600 ? await getEntity<CulturalSpot>(c, "spot", last.spotId) : null;
        if (prev && distanceMeters(prev.payload.coordinates, spot.coordinates) / Math.max(dt, 1) > MAX_SPEED_MS) {
          fail(403, "Perpindahan terlalu cepat dari check-in sebelumnya.", "IMPOSSIBLE_TRAVEL");
        }
      }
      const code = await uniqueCode(c, "checkin", "KDR", "code");
      const id = newId("ci");
      const createdAt = new Date().toISOString();
      await c.query("INSERT INTO entities(id,kind,owner_id,payload) VALUES($1,'checkin',$2,$3)", [id, visitorKey, JSON.stringify({ id, code, spotId: spot.id, createdAt, verified: false })]);
      const points = user ? 50 : 0;
      await addXp(c, user?.id, points);
      return { checkIn: { id, code, spotId: spot.id, createdAt }, awardedPoints: points };
    });
    return out;
  });

  // mitra verifikasi KDR di lapaknya: sekali, maks 24 jam. XP misi masuk ke akun wisatawan (tamu gak dapet)
  app.post("/api/checkins/verify", async (request) => {
    const user = requireRoles(request, ["MERCHANT", "ADMIN"]);
    const code = String(bodyOf(request).code ?? "").trim().toUpperCase();
    if (!code) bad("Masukkan kode kehadiran pengunjung.");
    return tx(async (c) => {
      const r = await c.query<{ id: string; owner_id: string | null; payload: { spotId: string; createdAt: string; verified: boolean; verifiedAt?: string; code: string } }>(
        "SELECT id,owner_id,payload FROM entities WHERE kind='checkin' AND payload->>'code'=$1 FOR UPDATE",
        [code]
      );
      const rec = r.rows[0];
      if (!rec) fail(404, `Kode "${code}" tidak ditemukan.`, "CHECKIN_NOT_FOUND");
      const spot = await getEntity<CulturalSpot>(c, "spot", rec.payload.spotId);
      if (!spot) fail(404, "Titik lokasi tidak ditemukan.");
      if (user.role !== "ADMIN" && spot.owner_id !== user.id) fail(403, "Kode ini untuk lapak lain, bukan lapak Anda.", "NOT_YOUR_SPOT");
      if (rec.payload.verified) fail(409, `Kode "${code}" sudah pernah diverifikasi.`, "CHECKIN_ALREADY_VERIFIED");
      if (Date.now() - Date.parse(rec.payload.createdAt) > 24 * 3600 * 1000) fail(410, `Kode "${code}" sudah lewat 24 jam dan tidak berlaku lagi.`, "CHECKIN_EXPIRED");
      rec.payload.verified = true;
      rec.payload.verifiedAt = new Date().toISOString();
      await c.query("UPDATE entities SET payload=$1 WHERE id=$2", [JSON.stringify(rec.payload), rec.id]);
      const account = rec.owner_id && !rec.owner_id.startsWith("guest:") ? rec.owner_id : null;
      const points = account ? spot.payload.quest.rewardPoints : 0;
      await addXp(c, account, points);
      return { verified: true, spotId: spot.id, spotName: spot.payload.name, awardedPoints: points, visitorHasAccount: !!account };
    });
  });

  // E-Ticket: cuma titik yg perlu pesan/bertiket. XP sekali/titik/hari, voucer pengalih cuma utk akun & sekali/lapak/hari
  app.post("/api/reservations", async (request) => {
    await rateLimit(pool, `reservation:${request.ip}`, 30, 3600, "Terlalu banyak permintaan reservasi. Coba lagi nanti.");
    const b = bodyOf(request);
    const visitorName = String(b.visitorName ?? "").trim().slice(0, 80);
    if (!visitorName) bad("Nama pemesan wajib diisi untuk menerbitkan E-Ticket.");
    const size = Number(b.partySize ?? 1);
    if (!Number.isInteger(size) || size < 1 || size > 20) fail(400, "Jumlah orang harus 1 sampai 20.", "VALIDATION");
    const user = currentUser(request);
    const row = await findVisibleSpot(pool, user, b.spotId);
    if (!row) fail(404, "Titik lokasi tidak ditemukan.", "NOT_FOUND");
    const spot = row.payload;
    if (!needsBooking(spot)) fail(400, `${spot.name} bebas masuk, tidak perlu tiket.`, "NO_BOOKING_NEEDED");
    const accept = b.acceptCircularQuest === true;

    // calon lapak pengalih: UMKM/sanggar terbit terdekat di kawasan yg sama, pemiliknya aktif
    let partner: CulturalSpot | undefined;
    if (accept && user) {
      const candidates = (await findPartners(spot)).sort((p, q) => distanceMeters(p.coordinates, spot.coordinates) - distanceMeters(q.coordinates, spot.coordinates));
      partner = candidates[0];
    }

    return tx(async (c) => {
      const ticketId = await uniqueCode(c, "reservation", `PASS-${spot.vibe.slice(0, 3).toUpperCase()}`, "ticketId");
      const reservation: ReservationPass = {
        ticketId,
        spotId: spot.id,
        spotName: spot.name,
        visitorName,
        partySize: size,
        scheduledSlot: String(b.scheduledSlot ?? "").trim().slice(0, 40) || spot.quota.nextAvailableSlot,
        status: "CONFIRMED",
        circularQuestAccepted: accept,
        createdAt: new Date().toISOString(),
      };
      await c.query("INSERT INTO entities(id,kind,owner_id,payload) VALUES($1,'reservation',$2,$3)", [ticketId, user?.id ?? null, JSON.stringify(reservation)]);
      let awardedPoints = 0;
      if (user && (await claimOnce(c, user.id, spot.id, "RESERVATION"))) {
        awardedPoints = 75;
        await addXp(c, user.id, awardedPoints);
      }
      let bonusVoucher: IssuedVoucher | undefined;
      let rewardNote: "LOGIN_FOR_REWARD" | "ALREADY_CLAIMED_TODAY" | "NO_PARTNER" | undefined;
      if (accept && !user) rewardNote = "LOGIN_FOR_REWARD";
      else if (accept && user) {
        if (!partner) rewardNote = "NO_PARTNER";
        else if (!(await claimOnce(c, user.id, partner.id, "REDIRECT"))) rewardNote = "ALREADY_CLAIMED_TODAY";
        else {
          const code = await uniqueCode(c, "voucher", "LKW", "code");
          const r = partner.quest.voucherReward;
          bonusVoucher = {
            code,
            signatureHash: voucherSignature(code, partner.id),
            spotId: partner.id,
            merchantName: r.merchantName,
            discountTitle: `Voucer Pengalih Antrean: ${r.discountTitle}`,
            discountAmount: r.discountAmount,
            minimumSpend: r.minimumSpend,
            // berlaku sampai akhir hari ini WIB, dicek kasir
            expiresAt: endOfWibDay(),
            issuedAt: new Date().toISOString(),
            status: "ACTIVE",
          };
          await c.query("INSERT INTO entities(id,kind,owner_id,payload) VALUES($1,'voucher',$2,$3)", [code, user.id, JSON.stringify(bonusVoucher)]);
        }
      }
      const mine = user ? await recordsVia(c, user.id) : { reservations: [reservation], vouchers: [] as IssuedVoucher[] };
      return { reservation, bonusVoucher, awardedPoints, rewardNote, ...mine };
    });
  });

  app.post("/api/reservations/checkin", async (request) => {
    requireRoles(request, ["ADMIN"]);
    const ticketId = String(bodyOf(request).ticketId ?? "").trim().toUpperCase();
    if (!ticketId) bad("Nomor tiket wajib diisi.");
    const reservation = await tx(async (c) => {
      const row = await getEntity<ReservationPass>(c, "reservation", ticketId, true);
      if (!row) fail(404, "E-Ticket tidak ditemukan.", "TICKET_NOT_FOUND");
      if (row.payload.status === "CHECKED_IN") fail(409, "E-Ticket ini sudah dipakai masuk.", "TICKET_ALREADY_USED");
      row.payload.status = "CHECKED_IN";
      await c.query("UPDATE entities SET payload=$1 WHERE kind='reservation' AND id=$2", [JSON.stringify(row.payload), row.id]);
      return row.payload;
    });
    return { reservation, reservations: (await listEntities<ReservationPass>(pool, "reservation")).map((x) => x.payload) };
  });

  // kasir: voucer sekali pakai, cuma di lapak penerbitnya, ditolak kalo kedaluwarsa. Baris dikunci (aman dr tebus dobel)
  app.post("/api/vouchers/redeem", async (request) => {
    const user = requireRoles(request, ["MERCHANT", "ADMIN"]);
    await rateLimit(pool, `redeem:${user.id}`, 120, 3600, "Terlalu banyak penebusan. Coba lagi nanti.");
    const raw = String(bodyOf(request).code ?? "").trim().toUpperCase();
    if (!raw) bad("Masukkan 6 digit angka atau kode lengkap voucer (contoh: LKW-849201).");
    const code = raw.startsWith("LKW-") ? raw : `LKW-${raw}`;
    const redeemedVoucher = await tx(async (c) => {
      const r = await c.query<{ id: string; payload: IssuedVoucher }>("SELECT id,payload FROM entities WHERE kind='voucher' AND payload->>'code'=$1 FOR UPDATE", [code]);
      const row = r.rows[0];
      if (!row) fail(404, `Kode voucer "${raw}" tidak ditemukan. Pastikan kode sesuai tas wisatawan.`, "VOUCHER_NOT_FOUND");
      if (user.role !== "ADMIN") {
        const owner = await c.query<{ owner_id: string | null }>("SELECT owner_id FROM entities WHERE kind='spot' AND id=$1", [row.payload.spotId]);
        if (owner.rows[0]?.owner_id !== user.id) fail(403, "Voucer ini berlaku di lapak lain, bukan lapak Anda.", "NOT_YOUR_VOUCHER");
      }
      if (row.payload.status === "REDEEMED") fail(409, `Kode voucer "${row.payload.code}" sudah pernah ditebus sebelumnya.`, "VOUCHER_ALREADY_REDEEMED");
      if (isExpiredIso(row.payload.expiresAt)) fail(410, `Kode voucer "${row.payload.code}" sudah kedaluwarsa.`, "VOUCHER_EXPIRED");
      row.payload.status = "REDEEMED";
      row.payload.redeemedAt = new Date().toISOString();
      await c.query("UPDATE entities SET payload=$1 WHERE id=$2 AND kind='voucher'", [JSON.stringify(row.payload), row.id]);
      await c.query("INSERT INTO redemption_audit(voucher_code,merchant_user_id) VALUES($1,$2)", [row.payload.code, user.id]);
      return row.payload;
    });
    // cuma voucer lapak milik akun ini (pengelola: semua)
    const own = await ownedSpotIds(pool, user);
    const all = (await listEntities<IssuedVoucher>(pool, "voucher")).map((x) => x.payload);
    return { redeemedVoucher, vouchers: own === "ALL" ? all : all.filter((v) => own.has(v.spotId)) };
  });
}

async function findPartners(spot: CulturalSpot) {
  if (!spot.regionId) return [];
  const r = await pool.query<{ payload: CulturalSpot }>(
    `SELECT s.payload FROM entities s LEFT JOIN users u ON u.id=s.owner_id
     WHERE s.kind='spot' AND s.payload->>'regionId'=$1 AND s.payload->>'spotType'<>'PRIMARY_DEST'
       AND COALESCE(s.payload->>'status','PUBLISHED')='PUBLISHED' AND (s.owner_id IS NULL OR u.status='ACTIVE')`,
    [spot.regionId]
  );
  return r.rows.map((x) => x.payload);
}

async function recordsVia(c: Parameters<typeof getEntity>[0], userId: string) {
  const [v, r] = await Promise.all([
    c.query<{ payload: IssuedVoucher }>("SELECT payload FROM entities WHERE kind='voucher' AND owner_id=$1 ORDER BY created_at DESC", [userId]),
    c.query<{ payload: ReservationPass }>("SELECT payload FROM entities WHERE kind='reservation' AND owner_id=$1 ORDER BY created_at DESC", [userId]),
  ]);
  return { vouchers: v.rows.map((x) => x.payload), reservations: r.rows.map((x) => x.payload) };
}

export { myRecords };
