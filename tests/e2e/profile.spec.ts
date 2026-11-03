import { test, expect } from "@playwright/test";
import { apiLogin, bearer, makePng, uiLogin, uniq } from "./helpers";

async function newVisitor(request: import("@playwright/test").APIRequestContext) {
  const email = `${uniq("wisata")}@uji.id`;
  const { token } = await (await request.post("/api/auth/register", { data: { name: "Wisatawan Uji", email, password: "rahasia123", role: "VISITOR" } })).json();
  return { email, token };
}

test("XP, kartu lore, voucer, dan tiket dicatat server per akun", async ({ request }) => {
  const spots = (await (await request.get("/api/spots")).json()).spots;
  // spot-mjp-02 milik mitra demo (buat tes verifikasi kehadiran)
  const spot = spots.find((s: { id: string }) => s.id === "spot-mjp-02");
  const { lat, lng } = spot.coordinates;
  const { token } = await newVisitor(request);

  expect((await request.get("/api/me/profile")).status()).toBe(401);
  const start = await (await request.get("/api/me/profile", { headers: bearer(token) })).json();
  expect(start).toMatchObject({ xp: 0, level: 1, checkedInSpotIds: [], loreCards: [], vouchers: [], reservations: [] });

  // check-in +50
  const ci = await (await request.post("/api/checkins", { headers: bearer(token), data: { spotId: spot.id, lat, lng, accuracyMeters: 10 } })).json();
  // reservasi +75 (dan voucer bonus kalo terima misi sirkular)
  const rsv = await request.post("/api/reservations", {
    headers: bearer(token),
    data: { spotId: spot.id, visitorName: "Wisatawan Uji", partySize: 2, scheduledSlot: "14:30 WIB", acceptCircularQuest: true },
  });
  expect(rsv.ok()).toBeTruthy();
  // scan objek: XP misi + voucer + kartu lore
  const scan = await (
    await request.post("/api/ai/lens-verify", { headers: bearer(token), multipart: { spotId: spot.id, lat: String(lat), lng: String(lng), accuracyMeters: "15", image: { name: "a.png", mimeType: "image/png", buffer: makePng(300, 300, true) } } })
  ).json();
  expect(scan.isVerified).toBe(true);

  // mitra pemilik lapak memverifikasi kode kehadiran: XP misi masuk ke wisatawan
  const mitra = await apiLogin(request, "mitra@lokawira.demo");
  const ver = await (await request.post("/api/checkins/verify", { headers: bearer(mitra), data: { code: ci.checkIn.code } })).json();
  expect(ver.verified).toBe(true);

  const p = await (await request.get("/api/me/profile", { headers: bearer(token) })).json();
  expect(p.xp).toBe(50 + 75 + scan.awardedPoints + ver.awardedPoints);
  expect(p.level).toBe(Math.floor(p.xp / 150) + 1);
  expect(p.checkedInSpotIds).toEqual([spot.id]);
  expect(p.loreCards).toHaveLength(1);
  expect(p.reservations).toHaveLength(1);
  expect(p.vouchers.length).toBe(2); // voucer scan + voucer bonus reservasi

  // snapshot untuk wisatawan login cuma berisi miliknya
  const snap = await (await request.get("/api/spots", { headers: bearer(token) })).json();
  expect(snap.vouchers.map((v: { code: string }) => v.code).sort()).toEqual(p.vouchers.map((v: { code: string }) => v.code).sort());

  // akun lain gak ikut kebagian
  const other = await newVisitor(request);
  const op = await (await request.get("/api/me/profile", { headers: bearer(other.token) })).json();
  expect(op.xp).toBe(0);
  expect(op.vouchers).toEqual([]);
});

test("UI: level dan XP di sheet Akun mengikuti catatan server setelah masuk", async ({ page, request }) => {
  const { email, token } = await newVisitor(request);
  const spot = (await (await request.get("/api/spots")).json()).spots[0];
  const { lat, lng } = spot.coordinates;
  await request.post("/api/checkins", { headers: bearer(token), data: { spotId: spot.id, lat, lng, accuracyMeters: 10 } });

  await uiLogin(page, email, "/", "rahasia123");
  await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
  await page.getByRole("button", { name: "Akun" }).first().click();
  await expect(page.getByText(/^50\s*XP/).first()).toBeVisible();
  await expect(page.getByRole("dialog").getByText("Level 1")).toBeVisible();
});
