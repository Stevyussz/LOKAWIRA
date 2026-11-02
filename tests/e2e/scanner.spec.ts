import { test, expect } from "@playwright/test";
import { makePng } from "./helpers";

test("scanner: format salah ditolak, foto kecil tidak dikenali, foto jelas berhasil", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Scan Objek" }).click();
  const input = page.locator("input[type=file]");

  await input.setInputFiles({ name: "x.txt", mimeType: "text/plain", buffer: Buffer.from("bukan gambar") });
  await expect(page.getByRole("alert").filter({ hasText: "JPEG, PNG, atau WebP" })).toBeVisible();

  await input.setInputFiles({ name: "kecil.png", mimeType: "image/png", buffer: makePng(16, 16, false) });
  await page.getByRole("button", { name: /Pindai/ }).click();
  await expect(page.getByRole("alert").filter({ hasText: "belum dikenali" })).toBeVisible();
  await expect(page.getByText("Kartu Koleksi Terbuka")).toBeHidden();

  await input.setInputFiles({ name: "besar.png", mimeType: "image/png", buffer: makePng(1400, 800, true) });
  await page.getByRole("button", { name: /Pindai/ }).click();
  await expect(page.getByText(/Kartu Koleksi Terbuka/)).toBeVisible();
  await expect(page.getByText("Voucer UMKM Berhasil Diklaim")).toBeVisible();
});
