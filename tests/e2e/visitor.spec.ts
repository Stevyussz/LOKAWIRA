import { test, expect } from "@playwright/test";
import { apiLogin, bearer, newVisitor } from "./helpers";

test("voucer pengalih antrean milik UMKM mitra terdekat dan bisa ditebus mitra itu", async ({ request }) => {
  const spots = (await (await request.get("/api/spots")).json()).spots as { id: string; spotType: string; vibe: string; quest: { voucherReward: { discountAmount: number } } }[];
  const primary = spots.find((s) => s.spotType === "PRIMARY_DEST" && s.vibe === "majapahit")!;
  // tamu: tiket terbit, tapi voucer pengalih perlu akun (biar gak dipanen)
  const guest = await (await request.post("/api/reservations", { data: { spotId: primary.id, visitorName: "Tamu Antre", partySize: 2, scheduledSlot: "14:30 WIB", acceptCircularQuest: true } })).json();
  expect(guest.reservation.ticketId).toBeTruthy();
  expect(guest.bonusVoucher).toBeFalsy();
  expect(guest.rewardNote).toBe("LOGIN_FOR_REWARD");

  const { token } = await newVisitor(request);
  const r = await request.post("/api/reservations", { headers: bearer(token), data: { spotId: primary.id, visitorName: "Wisatawan Antre", partySize: 2, scheduledSlot: "14:30 WIB", acceptCircularQuest: true } });
  const body = await r.json();
  const v = body.bonusVoucher;
  expect(v).toBeTruthy();
  // bukan milik cagar, tapi milik lapak mitra, dgn nominal dari promo lapak itu
  expect(v.spotId).not.toBe(primary.id);
  const partner = spots.find((s) => s.id === v.spotId)!;
  expect(partner.spotType).not.toBe("PRIMARY_DEST");
  expect(v.discountAmount).toBe(partner.quest.voucherReward.discountAmount);
  // akun baru cuma dapat miliknya sendiri, bukan punya orang lain
  expect(body.vouchers).toHaveLength(1);
  expect(body.reservations).toHaveLength(1);

  const mitra = await apiLogin(request, "mitra@lokawira.demo");
  const redeem = await request.post("/api/vouchers/redeem", { headers: bearer(mitra), data: { code: v.code } });
  expect(redeem.status()).toBe(200);
});
