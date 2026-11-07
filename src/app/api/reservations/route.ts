import crypto from "node:crypto";
import { distanceMeters } from "@/lib/geo";
import { mockDisabled } from "@/lib/server/mockBackend";
import { NextRequest, NextResponse } from "next/server";
import { awardXp, claimOnce, currentUser, endOfWibDay, ownerInactive, profileOf, visibleSpots } from "@/lib/server/mockBackend";
import { getLokawiraStore } from "@/lib/seedCulturalData";
import { needsBooking } from "@/lib/spotRules";
import { IssuedVoucher, ReservationPass } from "@/types/lokawira";

export async function POST(request: NextRequest) {
  const off = mockDisabled();
  if (off) return off;
  try {
    const body = await request.json();
    const { spotId, visitorName, partySize, scheduledSlot, acceptCircularQuest } = body;

    if (!visitorName || ! visitorName.trim()) {
      return NextResponse.json(
        { error: "Nama pemesan wajib diisi untuk menerbitkan E-Ticket." },
        { status: 400 }
      );
    }

    const size = Number(partySize ?? 1);
    if (!Number.isInteger(size) || size < 1 || size > 20) {
      return NextResponse.json({ error: "Jumlah orang harus 1 sampai 20.", code: "VALIDATION" }, { status: 400 });
    }
    const slot = String(scheduledSlot ?? "").trim().slice(0, 40);
    const store = getLokawiraStore();
    const user = currentUser(request);
    // id salah = 404, bkn diem2 pake titik pertama; titik yg gak keliatan juga gak bisa dipesan
    const spot = visibleSpots(user).find((s) => s.id === spotId);
    if (!spot) return NextResponse.json({ error: "Titik lokasi tidak ditemukan.", code: "NOT_FOUND" }, { status: 404 });
    // titik bebas masuk gak pake tiket sama sekali
    if (!needsBooking(spot)) {
      return NextResponse.json({ error: `${spot.name} bebas masuk, tidak perlu tiket.`, code: "NO_BOOKING_NEEDED" }, { status: 400 });
    }

    // kode tiket harus unik (tabrakan bikin tiket orang lain ketuker): acak 6 digit, ulang kalo sudah ada
    let ticketCode = "";
    do {
      ticketCode = `PASS-${spot.vibe.slice(0, 3).toUpperCase()}-${crypto.randomInt(100000, 999999)}`;
    } while (store.reservations.some((r) => r.ticketId === ticketCode));
    const newReservation: ReservationPass = {
      ticketId: ticketCode,
      spotId: spot.id,
      spotName: spot.name,
      visitorName: visitorName.trim(),
      partySize: size,
      scheduledSlot: slot || spot.quota.nextAvailableSlot,
      status: "CONFIRMED",
      circularQuestAccepted: Boolean(acceptCircularQuest),
      createdAt: new Date().toISOString(),
    };

    store.reservations.unshift(newReservation);
    // XP tiket cuma sekali per titik per hari (pesen berkali2 gak nambah XP)
    let awardedPoints = 0;
    if (user) {
      profileOf(user.id).ticketIds.add(newReservation.ticketId);
      if (claimOnce(user.id, spot.id, "RESERVATION")) awardedPoints = 75;
      awardXp(user.id, awardedPoints);
    }

    // voucer pengalih antrean = voucer milik UMKM mitra terdekat di kawasan yg sama (bkn milik cagar), biar mitra itu yg bisa nebus di kasirnya
    let bonusVoucher: IssuedVoucher | undefined;
    // voucer pengalih: perlu akun & sekali per hari per lapak mitra, biar gak dipanen
    let rewardNote: "LOGIN_FOR_REWARD" | "ALREADY_CLAIMED_TODAY" | "NO_PARTNER" | undefined;
    if (acceptCircularQuest && !user) rewardNote = "LOGIN_FOR_REWARD";
    if (acceptCircularQuest && user) {
      const partner = store.spots
        .filter((x) => x.vibe === spot.vibe && x.spotType !== "PRIMARY_DEST" && (x.status ?? "PUBLISHED") === "PUBLISHED" && !ownerInactive(x))
        .sort((p, q) => distanceMeters(p.coordinates, spot.coordinates) - distanceMeters(q.coordinates, spot.coordinates))[0];
      if (!partner) rewardNote = "NO_PARTNER";
      else if (!claimOnce(user.id, partner.id, "REDIRECT")) rewardNote = "ALREADY_CLAIMED_TODAY";
      else {
        let code = "";
        do {
          code = `LKW-${crypto.randomInt(100000, 999999)}`;
        } while (store.vouchers.some((v) => v.code === code));
        bonusVoucher = {
          code,
          signatureHash: `sha256:redir-${Date.now().toString(16)}`,
          spotId: partner.id,
          merchantName: partner.quest.voucherReward.merchantName,
          discountTitle: `Voucer Pengalih Antrean: ${partner.quest.voucherReward.discountTitle}`,
          discountAmount: partner.quest.voucherReward.discountAmount,
          minimumSpend: partner.quest.voucherReward.minimumSpend,
          // berlaku sampai akhir hari ini (WIB), dicek kasir
          expiresAt: endOfWibDay(),
          status: "ACTIVE",
        };
        store.vouchers.unshift(bonusVoucher);
        profileOf(user.id).voucherCodes.add(bonusVoucher.code);
      }
    }

    // user login dikasih miliknya sendiri, tamu cuma dapet yg barusan dibuat (jgn bocorin punya orang lain)
    const mine = user ? profileOf(user.id) : null;
    return NextResponse.json({
      reservation: newReservation,
      bonusVoucher,
      awardedPoints,
      // kenapa voucer pengalih gak terbit walau misinya diterima
      rewardNote,
      reservations: mine ? store.reservations.filter((r) => mine.ticketIds.has(r.ticketId)) : [newReservation],
      vouchers: mine ? store.vouchers.filter((v) => mine.voucherCodes.has(v.code)) : bonusVoucher ? [bonusVoucher] : [],
    });
  } catch {
    return NextResponse.json(
      { error: "Gagal memproses reservasi kuota terjadwal." },
      { status: 500 }
    );
  }
}
