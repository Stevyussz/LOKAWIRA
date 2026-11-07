import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { apiLogin, bearer, makePng, newVisitor, uiLogin } from "./helpers";

// dampak: jejak anonim + check-in + voucer ditukar, dilihat mitra (lapaknya) & pengelola (per kawasan)

test("API dampak: jejak anonim tercatat, mitra cuma lihat lapaknya, nilai voucer ditukar dihitung", async ({ request }) => {
  const mitra = await apiLogin(request, "mitra@lokawira.demo");
  const admin = await apiLogin(request, "admin@lokawira.demo");
  expect((await request.get("/api/metrics")).status()).toBe(401);
  expect((await request.post("/api/metrics", { data: { type: "SEMBARANG", spotId: "spot-mjp-02" } })).status()).toBe(400);
  expect((await request.post("/api/metrics", { data: { type: "QR_OPEN", spotId: "tidak-ada" } })).status()).toBe(404);

  const before = (await (await request.get("/api/metrics", { headers: bearer(mitra) })).json()).spots.find((s: { spotId: string }) => s.spotId === "spot-mjp-02");
  for (const type of ["QR_OPEN", "GUIDE_START", "REMINDER_SAVED"]) expect((await request.post("/api/metrics", { data: { type, spotId: "spot-mjp-02" } })).status()).toBe(202);

  // wisatawan scan -> voucer -> mitra tebus
  const spot = (await (await request.get("/api/spots")).json()).spots.find((s: { id: string }) => s.id === "spot-mjp-02");
  const { token } = await newVisitor(request);
  const scan = await (await request.post("/api/ai/lens-verify", { headers: bearer(token), multipart: { spotId: spot.id, lat: String(spot.coordinates.lat), lng: String(spot.coordinates.lng), accuracyMeters: "15", image: { name: "a.png", mimeType: "image/png", buffer: makePng(300, 300, true) } } })).json();
  await request.post("/api/vouchers/redeem", { headers: bearer(mitra), data: { code: scan.issuedVoucher.code } });

  const mine = await (await request.get("/api/metrics", { headers: bearer(mitra) })).json();
  const after = mine.spots.find((s: { spotId: string }) => s.spotId === "spot-mjp-02");
  expect(after.qrOpens).toBe(before.qrOpens + 1);
  expect(after.guides).toBe(before.guides + 1);
  expect(after.reminders).toBe(before.reminders + 1);
  expect(after.vouchersRedeemed).toBe(before.vouchersRedeemed + 1);
  expect(after.redeemedValue).toBe(before.redeemedValue + scan.issuedVoucher.discountAmount);
  expect(after.upcomingEvents).toBeGreaterThan(0);
  // mitra gak lihat lapak orang lain
  expect(mine.spots.map((s: { spotId: string }) => s.spotId)).not.toContain("spot-mjp-01");

  const all = await (await request.get("/api/metrics?regionId=rgn-majapahit", { headers: bearer(admin) })).json();
  expect(all.spots.every((s: { regionId: string }) => s.regionId === "rgn-majapahit")).toBe(true);
  expect(all.totals.spots).toBe(all.spots.length);
});

test("UI dampak: kartu dampak di dasbor mitra aksesibel; membuka poster QR dihitung", async ({ page, request }) => {
  const mitra = await apiLogin(request, "mitra@lokawira.demo");
  const before = (await (await request.get("/api/metrics", { headers: bearer(mitra) })).json()).spots.find((s: { spotId: string }) => s.spotId === "spot-mjp-02").qrOpens;
  await page.goto("/?titik=spot-mjp-02");
  await expect(page.getByRole("region", { name: /Detail lokasi Sanggar Kriya/ })).toBeVisible({ timeout: 20000 });
  await expect.poll(async () => (await (await request.get("/api/metrics", { headers: bearer(mitra) })).json()).spots.find((s: { spotId: string }) => s.spotId === "spot-mjp-02").qrOpens).toBe(before + 1);

  await uiLogin(page, "mitra@lokawira.demo", "/merchant-pos");
  await expect(page.getByRole("heading", { name: "Dampak lapakmu" })).toBeVisible();
  await expect(page.getByText("Poster QR dipindai")).toBeVisible();
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).exclude("nextjs-portal").analyze();
  expect(axe.violations.map((v) => `${v.id} (${v.nodes.length})`)).toEqual([]);
});
