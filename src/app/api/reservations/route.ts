import { mockDisabled } from "@/lib/server/mockBackend";
import { NextRequest, NextResponse } from "next/server";
import { awardXp, currentUser, profileOf } from "@/lib/server/mockBackend";
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

    const ticketCode = `PASS-${spot.vibe.slice(0, 3).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
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

    let bonusVoucher: IssuedVoucher | undefined;
    if (acceptCircularQuest) {
      const code = `LKW-${Math.floor(100000 + Math.random() * 900000)}`;
      bonusVoucher = {
        code,
        signatureHash: `sha256:redir-${Date.now().toString(16)}`,
        spotId: spot.id,
        merchantName: spot.quest.voucherReward.merchantName,
        discountTitle: `Voucer Pengalih Antrean: ${spot.quest.voucherReward.discountTitle}`,
        discountAmount: 15000,
        minimumSpend: spot.quest.voucherReward.minimumSpend,
        expiresAt: "Aktif Selama Menunggu Giliran Masuk",
        status: "ACTIVE",
      };
      store.vouchers.unshift(bonusVoucher);
      if (user) profileOf(user.id).voucherCodes.add(bonusVoucher.code);
    }

    // user login cuma dikasih miliknya sendiri, tamu dikasih semua (cuma buat demo)
    const mine = user ? profileOf(user.id) : null;
    return NextResponse.json({
      reservation: newReservation,
      bonusVoucher,
      reservations: mine ? store.reservations.filter((r) => mine.ticketIds.has(r.ticketId)) : store.reservations,
      vouchers: mine ? store.vouchers.filter((v) => mine.voucherCodes.has(v.code)) : store.vouchers,
    });
  } catch {
    return NextResponse.json(
      { error: "Gagal memproses reservasi kuota terjadwal." },
      { status: 500 }
    );
  }
}
