import { test, expect } from "@playwright/test";
import { apiLogin, bearer, makePng, newVisitor } from "./helpers";

// celah ekonomi: hadiah gak boleh bisa dipanen dgn ngulang aksi, voucer kedaluwarsa ditolak, data gak bocor

const firstSpot = async (request: import("@playwright/test").APIRequestContext) => (await (await request.get("/api/spots")).json()).spots[0];

test("scan: tamu dapat kisah tanpa voucer; akun dapat voucer sekali per titik per hari", async ({ request }) => {
  const spot = await firstSpot(request);
  const { lat, lng } = spot.coordinates;
  const scan = (headers?: Record<string, string>) =>
    request.post("/api/ai/lens-verify", {
      headers,
      multipart: { spotId: spot.id, lat: String(lat), lng: String(lng), accuracyMeters: "15", image: { name: "a.png", mimeType: "image/png", buffer: makePng(300, 300, true) } },
    });

  const guest = await (await scan()).json();
  expect(guest.isVerified).toBe(true);
  expect(guest.issuedVoucher).toBeFalsy();
  expect(guest.awardedPoints).toBe(0);
  expect(guest.rewardNote).toBe("LOGIN_FOR_REWARD");

  const { token } = await newVisitor(request);
  const first = await (await scan(bearer(token))).json();
  expect(first.issuedVoucher.code).toMatch(/^LKW-\d{6}$/);
  expect(first.awardedPoints).toBeGreaterThan(0);
  // masa berlaku asli: ISO, sekitar 7 hari
  const days = (new Date(first.issuedVoucher.expiresAt).getTime() - Date.now()) / 86400000;
  expect(days).toBeGreaterThan(6.9);
  expect(days).toBeLessThan(7.1);

  const again = await (await scan(bearer(token))).json();
  expect(again.isVerified).toBe(true);
  expect(again.issuedVoucher).toBeFalsy();
  expect(again.awardedPoints).toBe(0);
  expect(again.rewardNote).toBe("ALREADY_CLAIMED_TODAY");

  // kartu kisah gak dobel
  const prof = await (await request.get("/api/me/profile", { headers: bearer(token) })).json();
  expect(prof.loreCards.filter((c: { spotId: string }) => c.spotId === spot.id)).toHaveLength(1);
});

test("check-in tamu tanpa XP; reservasi: validasi, titik salah 404, XP sekali per hari", async ({ request }) => {
  const spot = await firstSpot(request);
  const { lat, lng } = spot.coordinates;
  const guest = await (await request.post("/api/checkins", { data: { spotId: spot.id, lat, lng, accuracyMeters: 10 } })).json();
  expect(guest.awardedPoints).toBe(0);
  expect(guest.checkIn.code).toMatch(/^KDR-\d{6}$/);

  const bad = await request.post("/api/reservations", { data: { spotId: spot.id, visitorName: "A", partySize: 0 } });
  expect(bad.status()).toBe(400);
  const missing = await request.post("/api/reservations", { data: { spotId: "spot-tidak-ada", visitorName: "A", partySize: 1 } });
  expect(missing.status()).toBe(404);

  const { token } = await newVisitor(request);
  const book = (h: Record<string, string>) => request.post("/api/reservations", { headers: h, data: { spotId: spot.id, visitorName: "Uji", partySize: 2, scheduledSlot: "10:00 WIB" } });
  const one = await (await book(bearer(token))).json();
  expect(one.awardedPoints).toBe(75);
  expect(new Date(one.reservation.createdAt).toString()).not.toBe("Invalid Date");
  const two = await (await book(bearer(token))).json();
  expect(two.awardedPoints).toBe(0);
});

test("kasir: voucer kedaluwarsa ditolak, respons cuma voucer lapak sendiri, KDR tamu tanpa XP", async ({ request }) => {
  const mitra = await apiLogin(request, "mitra@lokawira.demo");
  const expired = await request.post("/api/vouchers/redeem", { headers: bearer(mitra), data: { code: "LKW-100001" } });
  expect(expired.status()).toBe(410);
  expect((await expired.json()).code).toBe("VOUCHER_EXPIRED");

  // akun baru scan di lapak mitra demo -> voucer -> mitra tebus
  const spots = (await (await request.get("/api/spots")).json()).spots;
  const lapak = spots.find((s: { id: string }) => s.id === "spot-mjp-02");
  const { token } = await newVisitor(request);
  const scan = await (
    await request.post("/api/ai/lens-verify", {
      headers: bearer(token),
      multipart: { spotId: lapak.id, lat: String(lapak.coordinates.lat), lng: String(lapak.coordinates.lng), accuracyMeters: "15", image: { name: "a.png", mimeType: "image/png", buffer: makePng(300, 300, true) } },
    })
  ).json();
  const res = await (await request.post("/api/vouchers/redeem", { headers: bearer(mitra), data: { code: scan.issuedVoucher.code } })).json();
  expect(new Date(res.redeemedVoucher.redeemedAt).toString()).not.toBe("Invalid Date");
  // gak ada voucer lapak lain di respons
  const owned = new Set(spots.filter((s: { ownerId?: string }) => s.ownerId === "u-mitra-1").map((s: { id: string }) => s.id));
  for (const v of res.vouchers) expect(owned.has(v.spotId)).toBe(true);

  // KDR dari tamu: sah, tapi tanpa XP
  const ci = await (await request.post("/api/checkins", { data: { spotId: lapak.id, lat: lapak.coordinates.lat, lng: lapak.coordinates.lng, accuracyMeters: 10 } })).json();
  const ver = await (await request.post("/api/checkins/verify", { headers: bearer(mitra), data: { code: ci.checkIn.code } })).json();
  expect(ver.verified).toBe(true);
  expect(ver.visitorHasAccount).toBe(false);
  expect(ver.awardedPoints).toBe(0);
});
