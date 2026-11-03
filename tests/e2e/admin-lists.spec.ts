import { test, expect } from "@playwright/test";
import { apiLogin, bearer, uiLogin } from "./helpers";

test("daftar admin berpaginasi: kursor tanpa duplikat, filter, dan hanya ADMIN", async ({ request }) => {
  const spot = (await (await request.get("/api/spots")).json()).spots[0];
  for (let i = 0; i < 13; i++) {
    const r = await request.post("/api/reservations", { data: { spotId: spot.id, visitorName: `Tamu ${i}`, partySize: 1, scheduledSlot: "10:00 WIB", acceptCircularQuest: true } });
    expect(r.ok()).toBeTruthy();
  }
  const admin = await apiLogin(request, "admin@lokawira.demo");
  const mitra = await apiLogin(request, "mitra@lokawira.demo");
  expect((await request.get("/api/admin/reservations", { headers: bearer(mitra) })).status()).toBe(403);
  expect((await request.get("/api/admin/vouchers")).status()).toBe(401);

  const seen: string[] = [];
  let cursor: string | undefined;
  let pages = 0;
  do {
    const q = new URLSearchParams({ limit: "5", ...(cursor ? { cursor } : {}) });
    const body = await (await request.get(`/api/admin/reservations?${q}`, { headers: bearer(admin) })).json();
    expect(body.reservations.length).toBeLessThanOrEqual(5);
    seen.push(...body.reservations.map((r: { ticketId: string }) => r.ticketId));
    cursor = body.nextCursor;
    pages++;
  } while (cursor && pages < 20);
  expect(pages).toBeGreaterThanOrEqual(3);
  expect(new Set(seen).size).toBe(seen.length);

  const done = await (await request.get("/api/admin/reservations?status=CHECKED_IN", { headers: bearer(admin) })).json();
  expect(done.reservations.every((r: { status: string }) => r.status === "CHECKED_IN")).toBe(true);
  const act = await (await request.get("/api/admin/vouchers?status=ACTIVE&limit=3", { headers: bearer(admin) })).json();
  expect(act.vouchers.length).toBeLessThanOrEqual(3);
  expect(act.vouchers.every((v: { status: string }) => v.status === "ACTIVE")).toBe(true);
});

test("UI admin: tiket dimuat bertahap dan bisa ditandai masuk", async ({ page }) => {
  await uiLogin(page, "admin@lokawira.demo", "/admin");
  await page.getByRole("tab", { name: /Kuota & Tiket/ }).click();
  const more = page.getByRole("button", { name: "Muat lebih banyak" }).first();
  await expect(more).toBeVisible({ timeout: 30_000 });
  const rows = page.getByRole("button", { name: /^Check-in tiket / });
  const before = await rows.count();
  await more.click();
  await expect.poll(async () => rows.count()).toBeGreaterThan(before);
  const first = rows.first();
  await first.click();
  await expect(page.getByText(/ditandai masuk lokasi/)).toBeVisible();
});
