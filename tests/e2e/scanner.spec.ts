import { test, expect } from "@playwright/test";
import { makePng, newVisitor, pageAtFirstSpot, uiLogin } from "./helpers";

test("scanner: format salah ditolak, foto kecil tidak dikenali, foto jelas berhasil", async ({ browser, request }) => {
  const { ctx, page } = await pageAtFirstSpot(browser, request);
  // voucer cuma buat akun
  const u = await newVisitor(request);
  await uiLogin(page, u.email, "/", u.password);
  await page.getByRole("button", { name: "Scan Objek" }).click();
  const input = page.locator("input[type=file]");

  await input.setInputFiles({ name: "x.txt", mimeType: "text/plain", buffer: Buffer.from("bukan gambar") });
  await expect(page.getByRole("alert").filter({ hasText: "JPEG, PNG, atau WebP" })).toBeVisible();

  await input.setInputFiles({ name: "kecil.png", mimeType: "image/png", buffer: makePng(16, 16, false) });
  await page.getByRole("button", { name: /Pindai/ }).click();
  // mesin tes (WebGL lewat SwiftShader) lambat ngolah gambar, jadi waktu tunggunya dilonggarin
  await expect(page.getByRole("alert").filter({ hasText: "belum dikenali" })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("Kartu Koleksi Terbuka")).toBeHidden();

  await input.setInputFiles({ name: "besar.png", mimeType: "image/png", buffer: makePng(1400, 800, true) });
  await page.getByRole("button", { name: /Pindai/ }).click();
  // server nyalain geofence: minta lokasi sekali (persetujuan dulu), lalu scan diulang otomatis
  await page.getByRole("button", { name: "Izinkan", exact: true }).click();
  await expect(page.getByText(/Kartu Koleksi Terbuka/)).toBeVisible();
  await expect(page.getByText("Voucer UMKM Berhasil Diklaim")).toBeVisible();
  await ctx.close();
});

test("scan ditolak kalo orangnya jauh dari titik (di UI muncul jarak)", async ({ browser, request }) => {
  const spot = (await (await request.get("/api/spots")).json()).spots[0];
  const ctx = await browser.newContext({
    permissions: ["geolocation"],
    geolocation: { latitude: spot.coordinates.lat + 0.003, longitude: spot.coordinates.lng, accuracy: 15 },
    viewport: { width: 768, height: 900 },
  });
  const page = await ctx.newPage();
  await page.goto("/");
  await page.getByRole("button", { name: "Scan Objek" }).click();
  await page.locator("input[type=file]").setInputFiles({ name: "besar.png", mimeType: "image/png", buffer: makePng(1400, 800, true) });
  await page.getByRole("button", { name: /Pindai/ }).click();
  await page.getByRole("button", { name: "Izinkan", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: /Kamu sekitar .* dari / })).toBeVisible();
  await expect(page.getByText("Kartu Koleksi Terbuka")).toBeHidden();
  await ctx.close();
});
