import { test, expect } from "@playwright/test";

test("PWA: manifest lengkap, ikon ada, service worker aktif, halaman offline tersedia", async ({ browser, request }) => {
  const m = await (await request.get("/manifest.webmanifest")).json();
  expect(m.display).toBe("standalone");
  expect(m.start_url).toBe("/");
  expect(m.icons.map((i: { sizes: string }) => i.sizes)).toEqual(expect.arrayContaining(["192x192", "512x512"]));
  expect(m.icons.some((i: { purpose?: string }) => i.purpose === "maskable")).toBe(true);
  for (const i of m.icons) expect((await request.get(i.src)).ok()).toBeTruthy();
  expect((await request.get("/offline")).ok()).toBeTruthy();

  const ctx = await browser.newContext({ serviceWorkers: "allow" });
  const page = await ctx.newPage();
  await page.goto("/");
  await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  expect(scope).toMatch(/\/$/);

  // offline: halaman yg pernah dibuka tetap kebuka dr cache
  await page.reload();
  await ctx.setOffline(true);
  await page.goto("/offline");
  await expect(page.getByRole("heading", { name: "Sinyal sedang hilang" })).toBeVisible();
  await ctx.close();
});

test("animasi: HP dgn 'kurangi animasi' turun ke dikurangi, tapi pengguna bisa pilih Penuh di Akun", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-motion", "reduce");
  await page.getByRole("button", { name: "Akun" }).first().click();
  await expect(page.getByText(/kurangi animasi/)).toBeVisible();
  await page.getByText("Penuh", { exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-motion", "full");
  // pilihan diingat setelah dimuat ulang
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-motion", "full");
  await ctx.close();
});

test("animasi: HP RAM kecil (deviceMemory 2) otomatis hemat", async ({ browser }) => {
  const ctx = await browser.newContext();
  await ctx.addInitScript(() => Object.defineProperty(navigator, "deviceMemory", { get: () => 2 }));
  const page = await ctx.newPage();
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-motion", "lite");
  await expect(page.locator("html")).toHaveAttribute("data-perf", "low");
  await ctx.close();
});
