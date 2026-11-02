import { test, expect } from "@playwright/test";
import { apiLogin, bearer, uniq } from "./helpers";

// server tes menyalakan geofence (radius 100 m), lihat playwright.config.ts
test("check-in ditolak tanpa lokasi, terlalu jauh, atau GPS kasar; lolos di titik", async ({ request }) => {
  const spot = (await (await request.get("/api/spots")).json()).spots[0];
  const { lat, lng } = spot.coordinates;

  const none = await request.post("/api/checkins", { data: { spotId: spot.id } });
  expect(none.status()).toBe(400);
  expect((await none.json()).code).toBe("LOCATION_REQUIRED");

  const far = await request.post("/api/checkins", { data: { spotId: spot.id, lat: lat + 0.003, lng, accuracyMeters: 20 } });
  expect(far.status()).toBe(403);
  const farBody = await far.json();
  expect(farBody.code).toBe("OUT_OF_RANGE");
  expect(farBody.details.distanceMeters).toBeGreaterThan(300);

  const rough = await request.post("/api/checkins", { data: { spotId: spot.id, lat, lng, accuracyMeters: 500 } });
  expect((await rough.json()).code).toBe("LOCATION_TOO_INACCURATE");

  const email = `${uniq("tamu")}@uji.id`;
  const { token } = await (await request.post("/api/auth/register", { data: { name: "Uji Geo", email, password: "rahasia123", role: "VISITOR" } })).json();
  const okRes = await request.post("/api/checkins", { headers: bearer(token), data: { spotId: spot.id, lat, lng, accuracyMeters: 15 } });
  expect(okRes.ok()).toBeTruthy();
  expect((await okRes.json()).checkIn.code).toMatch(/^KDR-\d+$/);

  // satu check-in per titik per hari
  const dup = await request.post("/api/checkins", { headers: bearer(token), data: { spotId: spot.id, lat, lng, accuracyMeters: 15 } });
  expect(dup.status()).toBe(409);
  expect((await dup.json()).code).toBe("ALREADY_CHECKED_IN_TODAY");
});

test("di UI: jauh ditolak dengan jarak, lalu pemandu menyatakan sudah tiba dan check-in berhasil", async ({ browser, request }) => {
  const spot = (await (await request.get("/api/spots")).json()).spots[0];
  const { lat, lng } = spot.coordinates;
  const ctx = await browser.newContext({ permissions: ["geolocation"], geolocation: { latitude: lat + 0.003, longitude: lng, accuracy: 20 }, viewport: { width: 768, height: 900 } });
  const page = await ctx.newPage();
  await page.goto("/");

  await page.getByRole("button", { name: "Check-In", exact: true }).click();
  await page.getByRole("button", { name: "Izinkan", exact: true }).click();
  await expect(page.getByText(/Kamu sekitar .* dari /)).toBeVisible();

  await page.getByRole("button", { name: "Pandu aku ke sini" }).click();
  await expect(page.getByText(/ke arah selatan/)).toBeVisible();

  await ctx.setGeolocation({ latitude: lat, longitude: lng, accuracy: 15 });
  await expect(page.getByText("Kamu sudah tiba. Silakan Check-In.")).toBeVisible();
  await page.getByRole("button", { name: "Check-In", exact: true }).click();
  await expect(page.getByText(/KDR-\d+/)).toBeVisible();
  await ctx.close();
});
