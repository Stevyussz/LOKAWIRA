import { test, expect } from "@playwright/test";
import { apiLogin, bearer } from "./helpers";

// cara masuk (bebas/pesan/tiket), jam buka, dan acara bertanggal

const spotsOf = async (request: import("@playwright/test").APIRequestContext, token?: string) =>
  (await (await request.get("/api/spots", { headers: token ? bearer(token) : undefined })).json()).spots as { id: string; spotType: string; entry?: unknown; coordinates: { lat: number; lng: number } }[];

test("titik bebas masuk gak bisa dipesan tiketnya; cagar utama tetap bisa", async ({ request }) => {
  const spots = await spotsOf(request);
  const free = spots.find((s) => s.spotType !== "PRIMARY_DEST")!;
  const r = await request.post("/api/reservations", { data: { spotId: free.id, visitorName: "Uji", partySize: 1 } });
  expect(r.status()).toBe(400);
  expect((await r.json()).code).toBe("NO_BOOKING_NEEDED");
  const primary = spots.find((s) => s.spotType === "PRIMARY_DEST")!;
  expect((await request.post("/api/reservations", { data: { spotId: primary.id, visitorName: "Uji", partySize: 1 } })).ok()).toBeTruthy();
});

test("validasi & ubah atomik: jam/harga/acara salah ditolak tanpa mengubah field lain", async ({ request }) => {
  const admin = await apiLogin(request, "admin@lokawira.demo");
  const spot = (await spotsOf(request))[0];
  const bad = await request.patch(`/api/spots/${spot.id}`, { headers: bearer(admin), data: { name: "Nama Yang Tak Boleh Tersimpan", openingHours: { days: [1], open: "25:00", close: "10:00" } } });
  expect(bad.status()).toBe(400);
  const after = (await spotsOf(request)).find((s) => s.id === spot.id) as unknown as { name: string };
  expect(after.name).not.toBe("Nama Yang Tak Boleh Tersimpan");

  expect((await request.patch(`/api/spots/${spot.id}`, { headers: bearer(admin), data: { entry: { mode: "TICKET", priceIdr: -5 } } })).status()).toBe(400);
  expect((await request.patch(`/api/spots/${spot.id}`, { headers: bearer(admin), data: { spotType: "SEMBARANG" } })).status()).toBe(400);
  const ev = await request.patch(`/api/spots/${spot.id}`, { headers: bearer(admin), data: { event: { startsAt: "2026-12-02T10:00:00Z", endsAt: "2026-12-01T10:00:00Z" } } });
  expect(ev.status()).toBe(400);

  const ok = await (await request.patch(`/api/spots/${spot.id}`, { headers: bearer(admin), data: { entry: { mode: "TICKET", priceIdr: 15000, note: "Bayar di loket" } } })).json();
  expect(ok.spot.entry).toEqual({ mode: "TICKET", priceIdr: 15000, note: "Bayar di loket" });
  // balikin seperti semula
  await request.patch(`/api/spots/${spot.id}`, { headers: bearer(admin), data: { entry: null } });
});

test("tutup: check-in ditolak; acara yg sudah selesai hilang dari peta publik", async ({ request }) => {
  const admin = await apiLogin(request, "admin@lokawira.demo");
  const base = (await spotsOf(request))[0] as unknown as Record<string, unknown> & { coordinates: { lat: number; lng: number } };
  const mk = async (extra: Record<string, unknown>) =>
    (await (await request.post("/api/spots", { headers: bearer(admin), data: { ...base, name: `Uji Jadwal ${Math.random().toString(36).slice(2, 7)}`, ...extra } })).json()).spot as { id: string };

  // jam buka cuma 1 menit, di hari lain dari sekarang => pasti tutup
  const otherDay = (new Date().getUTCDay() + 3) % 7;
  const closed = await mk({ openingHours: { days: [otherDay], open: "08:00", close: "08:01" } });
  const ci = await request.post("/api/checkins", { data: { spotId: closed.id, lat: base.coordinates.lat, lng: base.coordinates.lng, accuracyMeters: 10 } });
  expect(ci.status()).toBe(409);
  expect((await ci.json()).code).toBe("CLOSED_NOW");

  const ended = await mk({ event: { startsAt: new Date(Date.now() - 3 * 3600e3).toISOString(), endsAt: new Date(Date.now() - 3600e3).toISOString() } });
  expect((await spotsOf(request)).map((s) => s.id)).not.toContain(ended.id);
  expect((await spotsOf(request, admin)).map((s) => s.id)).toContain(ended.id);

  const upcoming = await mk({ event: { startsAt: new Date(Date.now() + 3600e3).toISOString(), endsAt: new Date(Date.now() + 2 * 3600e3).toISOString() } });
  expect((await spotsOf(request)).map((s) => s.id)).toContain(upcoming.id);
  const early = await request.post("/api/checkins", { data: { spotId: upcoming.id, lat: base.coordinates.lat, lng: base.coordinates.lng, accuracyMeters: 10 } });
  expect((await early.json()).code).toBe("CLOSED_NOW");

  for (const id of [closed.id, ended.id, upcoming.id]) await request.delete(`/api/spots/${id}`, { headers: bearer(admin) });
});

test("UI: semua titik punya Info; titik bebas masuk tanpa tombol pesan, cagar utama bisa pesan slot", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /^Pilih titik / }).first()).toBeVisible({ timeout: 20000 });
  // titik pertama = cagar utama (pesan slot)
  await expect(page.getByRole("button", { name: "Pesan slot", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Info", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /^Pilih titik Sanggar/ }).first().click();
  await expect(page.getByRole("button", { name: /^Pesan (slot|tiket)$/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Info", exact: true }).click();
  const info = page.getByRole("dialog");
  await expect(info.getByText("Bebas masuk, tanpa tiket")).toBeVisible();
  await expect(info.getByRole("button", { name: /^Pesan/ })).toHaveCount(0);
});
