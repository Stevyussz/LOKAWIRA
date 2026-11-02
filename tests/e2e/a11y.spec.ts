import { test, expect, Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { uiLogin } from "./helpers";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];
async function expectNoViolations(page: Page, label: string) {
  const r = await new AxeBuilder({ page }).withTags(TAGS).exclude("nextjs-portal").analyze();
  expect(r.violations.map((v) => `${label}: ${v.id} (${v.nodes.length})`)).toEqual([]);
}

for (const width of [360, 390]) {
  test.describe(`aksesibilitas ${width}px`, () => {
    test.use({ viewport: { width, height: 800 } });

    test("beranda, Tas, dan Akun", async ({ page }) => {
      await page.goto("/");
      await expectNoViolations(page, "beranda");
      await page.locator('[data-nav-id="WALLET"]').click();
      await expectNoViolations(page, "tas");
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "Akun" }).first().click();
      await expectNoViolations(page, "akun");
    });

    test("masuk, lupa sandi, dan dasbor admin", async ({ page }) => {
      await page.goto("/masuk");
      await expectNoViolations(page, "masuk");
      await page.goto("/lupa-sandi");
      await expectNoViolations(page, "lupa-sandi");
      await uiLogin(page, "admin@lokawira.demo", "/admin");
      await expect(page.getByRole("heading", { name: /Verifikasi E-Ticket Masuk/ })).toBeVisible({ timeout: 30_000 });
      await expectNoViolations(page, "admin-tiket");
      await page.getByRole("tab", { name: /Persetujuan/ }).click();
      await expectNoViolations(page, "admin-persetujuan");
    });
  });
}
