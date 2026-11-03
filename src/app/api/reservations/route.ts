import crypto from "node:crypto";
import { distanceMeters } from "@/lib/geo";
import { mockDisabled } from "@/lib/server/mockBackend";
import { NextRequest, NextResponse } from "next/server";
import { awardXp, currentUser, ownerInactive, profileOf } from "@/lib/server/mockBackend";
import { getLokawiraStore } from "@/lib/seedCulturalData";
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

    const store = getLokawiraStore();
    const spot = store.spots.find((s) => s.id === spotId) || store.spots[0];

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
      partySize: Number(partySize) || 1,
      scheduledSlot: scheduledSlot || spot.quota.nextAvailableSlot,
      status: "CONFIRMED",
      circularQuestAccepted: Boolean(acceptCircularQuest),
      createdAt: "Baru saja diterbitkan",
    };

    store.reservations.unshift(newReservation);
    const user = currentUser(request);
    if (user) {
      profileOf(user.id).ticketIds.add(newReservation.ticketId);
      awardXp(user.id, 75);
    }

    // voucer pengalih antrean = voucer milik UMKM mitra terdekat di kawasan yg sama (bkn milik cagar), biar mitra itu yg bisa nebus di kasirnya
    let bonusVoucher: IssuedVoucher | undefined;
    if (acceptCircularQuest) {
      const partner = store.spots
        .filter((x) => x.vibe === spot.vibe && x.spotType !== "PRIMARY_DEST" && (x.status ?? "PUBLISHED") === "PUBLISHED" && !ownerInactive(x))
        .sort((p, q) => distanceMeters(p.coordinates, spot.coordinates) - distanceMeters(q.coordinates, spot.coordinates))[0];
      if (partner) {
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
          expiresAt: "Aktif Selama Menunggu Giliran Masuk",
          status: "ACTIVE",
        };
        store.vouchers.unshift(bonusVoucher);
        if (user) profileOf(user.id).voucherCodes.add(bonusVoucher.code);
      }
    }

    // user login dikasih miliknya sendiri, tamu cuma dapet yg barusan dibuat (jgn bocorin punya orang lain)
    const mine = user ? profileOf(user.id) : null;
    return NextResponse.json({
      reservation: newReservation,
      bonusVoucher,
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
