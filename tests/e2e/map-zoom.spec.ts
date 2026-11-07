import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.use({ viewport: { width: 1024, height: 800 } });

test("zoom out: pin mengecil, titik bertumpuk jadi lingkaran berangka, diketuk = perbesar lagi", async ({ page }) => {
  await page.goto("/");
  const pins = page.getByRole("button", { name: /^Pilih titik / });
  await expect(pins.first()).toBeVisible({ timeout: 20000 });
  const before = await pins.count();
  expect(before).toBeGreaterThan(1);

  // kartu lokasi di bawah disembunyiin dulu biar gak nutup peta
  const hide = page.getByRole("button", { name: "Sembunyikan kartu lokasi" });
  if (await hide.count()) await hide.click();

  // perkecil sampai pin2 kawasan bertumpuk
  const out = page.getByRole("button", { name: "Perkecil peta" });
  const cluster = page.getByRole("button", { name: /titik di sekitar sini/ });
  for (let i = 0; i < 7 && (await cluster.count()) === 0; i++) {
    await out.click();
    await page.waitForTimeout(450);
  }
  await expect(cluster.first()).toBeVisible();
  // anggota kelompok disembunyikan: jumlah pin terlihat berkurang
  expect(await pins.count()).toBeLessThan(before);

  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).exclude("nextjs-portal").analyze();
  expect(axe.violations.map((v) => `${v.id} (${v.nodes.length})`)).toEqual([]);

  // ketuk lingkaran: peta memperbesar dan pin2 muncul lagi
  await cluster.first().click();
  await expect(cluster).toHaveCount(0, { timeout: 5000 });
  await expect.poll(async () => pins.count()).toBeGreaterThanOrEqual(before - 1);
});
