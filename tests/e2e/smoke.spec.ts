import { test, expect } from "@playwright/test";

test("beranda memuat peta tanpa galat dan sheet utama bisa dibuka", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("button", { name: /^Pilih titik / }).first()).toBeVisible();

  for (const nav of ["WALLET", "QUOTA"]) {
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
