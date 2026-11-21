import { test, expect, Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { bearer, newVisitor, uiLogin } from "./helpers";

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

async function expectNoViolations(page: Page, label: string) {
  const res = await new AxeBuilder({ page }).withTags(AXE_TAGS).exclude("nextjs-portal").analyze();
  expect(res.violations.map((v) => `${label}: ${v.id} (${v.nodes.length})`)).toEqual([]);
}

test("API: normalisasi slot jam masuk menyatukan kapasitas 14:30 dan 14.30", async ({ request }) => {
  const spotsRes = await (await request.get("/api/spots")).json();
  const spot = spotsRes.spots.find((s: { spotType: string }) => s.spotType === "PRIMARY_DEST") ?? spotsRes.spots[0];
  const cap: number = spot.quota.maxCapacity;
  const { token } = await newVisitor(request);

  // Gunakan slot unik 06:15 agar tidak memengaruhi uji antrean slot lain
  const formats = ["06:15", "06.15", "06:15 wib"];
  let left = cap;
  let i = 0;
  while (left > 0) {
    const batch = Math.min(20, left);
    const res = await request.post("/api/reservations", {
      headers: bearer(token),
      data: {
        spotId: spot.id,
        visitorName: `Uji Slot ${i}`,
        partySize: batch,
        scheduledSlot: formats[i % formats.length],
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.reservation.scheduledSlot).toBe("06:15 WIB");
    left -= batch;
    i++;
  }

  // Kapasitas slot gabungan sudah penuh: permintaan ke slot yang sama ditolak 409 SLOT_FULL
  const full = await request.post("/api/reservations", {
    headers: bearer(token),
    data: { spotId: spot.id, visitorName: "Penuh", partySize: 1, scheduledSlot: "06.15" },
  });
  expect(full.status()).toBe(409);
  expect((await full.json()).code).toBe("SLOT_FULL");
});

test("UI: Tas Petualang menampilkan QR SVG nyata pada E-Ticket dan Voucer", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/");
  await page.locator('[data-nav-id="WALLET"]').click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Tas Petualang" })).toBeVisible();

  // Tab Voucer: buka kode QR ke kasir
  const showBtn = dialog.getByRole("button", { name: "Tunjukkan ke kasir" }).first();
  await expect(showBtn).toBeVisible();
  await showBtn.click();
  await expect(dialog.locator('[role="img"][aria-label*="QR Voucer"] svg').first()).toBeVisible();

  // Tab E-Ticket: tampilkan QR gerbang masuk
  await dialog.getByRole("tab", { name: /E-Ticket/ }).click();
  await expect(dialog.locator('[role="img"][aria-label*="QR E-Ticket"] svg').first()).toBeVisible();
  await expectNoViolations(page, "wallet-qr");
});

test("UI: /verifikasi-email dan /laporan-dampak tampil bersih dan lolos WCAG AA", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/verifikasi-email");
  await expect(page.getByRole("heading", { name: "Verifikasi email" })).toBeVisible();
  await expectNoViolations(page, "verifikasi-email");

  await uiLogin(page, "admin@lokawira.demo", "/laporan-dampak");
  await expect(page.getByRole("heading", { name: /Ringkasan Kinerja Ekonomi/ })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/UU PDP No\. 27 Tahun 2022/)).toBeVisible();
  await page.getByRole("button", { name: "7 hari" }).click();
  await expect(page.getByRole("heading", { name: /\(7 Hari\)/ })).toBeVisible();
  await expectNoViolations(page, "laporan-dampak");
});

test("UI: Rute Jelajah Kawasan membuka daftar berurut dan mendukung mode sepeda motor", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/");
  const trailBtn = page.getByRole("button", { name: "Buka rute jelajah terurut antartitik" });
  await expect(trailBtn).toBeVisible();
  await trailBtn.click();

  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("heading", { name: "Rute Jelajah Kawasan" })).toBeVisible();
  await sheet.getByRole("button", { name: "Sepeda motor" }).click();
  await expect(sheet.getByRole("button", { name: "Sepeda motor" })).toHaveAttribute("aria-pressed", "true");
  await expectNoViolations(page, "rute-jelajah");

  await sheet.getByRole("button", { name: "Tampilkan rute di peta" }).click();
  await expect(sheet).toBeHidden();
});
