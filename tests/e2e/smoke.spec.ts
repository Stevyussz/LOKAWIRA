import { test, expect } from "@playwright/test";
import { makePng, newVisitor, pageAtFirstSpot, uiLogin } from "./helpers";

test("beranda memuat peta tanpa galat dan sheet utama bisa dibuka", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("button", { name: /^Pilih titik / }).first()).toBeVisible();

  for (const nav of ["WALLET", "AGENDA"]) {
    await page.locator(`[data-nav-id="${nav}"]`).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
  }
  expect(errors).toEqual([]);
});

test("sheet Akun menampilkan progres Perjalananku", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Akun" }).first().click();
  await expect(page.locator("#journey-title")).toHaveText("Perjalananku");
  await expect(page.getByRole("progressbar")).toBeVisible();
});

test("titik yang menunggu review tidak muncul di API publik", async ({ request }) => {
  const res = await request.get("/api/spots");
  const ids = (await res.json()).spots.map((s: { id: string }) => s.id);
  expect(ids).not.toContain("spot-demo-pending");
});

test("peta nyata: kanvas OpenStreetMap termuat, atribusi ada, dan tanpa penanda Kamu palsu", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  await expect(page.locator(".maplibregl-ctrl-attrib")).toBeAttached();
  const attrib = await page.locator(".maplibregl-ctrl-attrib").textContent();
  expect(attrib).toContain("OpenStreetMap");
  // tanpa izin lokasi, gak boleh ada penanda posisi buatan
  await expect(page.getByRole("img", { name: "Posisimu" })).toHaveCount(0);
});

test("voucer di Tas: hasil scan bisa ditunjukkan ke kasir (kode tampil), bukan pindah ke halaman kasir", async ({ browser, request }) => {
  const { ctx, page } = await pageAtFirstSpot(browser, request);
  const u = await newVisitor(request);
  await uiLogin(page, u.email, "/", u.password);
  await page.getByRole("button", { name: "Scan Objek" }).click();
  await page.locator("input[type=file]").setInputFiles({ name: "besar.png", mimeType: "image/png", buffer: makePng(1400, 800, true) });
  await page.getByRole("button", { name: /Pindai/ }).click();
  await page.getByRole("button", { name: "Izinkan", exact: true }).click();
  await expect(page.getByText("Voucer UMKM Berhasil Diklaim")).toBeVisible();
  await page.getByRole("button", { name: "Simpan ke Tas" }).click();

  await page.locator('[data-nav-id="WALLET"]').click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const tab = dialog.getByRole("tab", { name: /Voucer/i });
  if (await tab.count()) await tab.first().click();
  const show = dialog.getByRole("button", { name: "Tunjukkan ke kasir" }).first();
  await expect(show).toBeVisible();
  const before = page.url();
  await show.click();
  await expect(dialog.getByText(/LKW-[A-Z0-9-]+/).first()).toBeVisible();
  expect(page.url()).toBe(before);
  await ctx.close();
});

test("snapshot publik: tamu tidak menerima voucer atau tiket milik orang lain", async ({ request }) => {
  const snap = await (await request.get("/api/spots")).json();
  expect(snap.vouchers).toEqual([]);
  expect(snap.reservations).toEqual([]);
});
