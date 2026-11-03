import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { apiLogin, bearer, makePng, uiLogin } from "./helpers";

// dasbor mitra: kasir satu kotak kode, nominal bebas, foto contoh objek, pin lewat pencarian & lokasi

test("kasir: satu kotak kode buat voucer (LKW-) dan bukti hadir (KDR-), kode salah dijelaskan", async ({ page, request }) => {
  // pengunjung check-in di lapak mitra demo -> dapat kode KDR-
  const spot = (await (await request.get("/api/spots")).json()).spots.find((x: { id: string }) => x.id === "spot-mjp-02");
  const ci = await request.post("/api/checkins", { data: { spotId: "spot-mjp-02", lat: spot.coordinates.lat, lng: spot.coordinates.lng, accuracyMeters: 10 } });
  const kdr = (await ci.json()).checkIn.code as string;

  await uiLogin(page, "mitra@lokawira.demo", "/merchant-pos");
  await expect(page.getByRole("heading", { name: "Dasbor Mitra" })).toBeVisible();
  const box = page.getByLabel("Kode dari pengunjung");

  await box.fill("12345");
  await page.getByRole("button", { name: "Periksa kode" }).click();
  await expect(page.getByText("Kodenya belum benar")).toBeVisible();

  await box.fill(kdr);
  await expect(page.getByText(/bukti hadir/i).first()).toBeVisible();
  await page.getByRole("button", { name: "Verifikasi kehadiran" }).click();
  await expect(page.getByText("Kehadiran terverifikasi")).toBeVisible();

  // kode yg sama gak bisa dipakai dua kali
  await box.fill(kdr);
  await page.getByRole("button", { name: "Verifikasi kehadiran" }).click();
  await expect(page.getByText(/sudah pernah diverifikasi/)).toBeVisible();

  await box.fill("LKW-849201");
  await page.getByRole("button", { name: "Tukarkan voucer" }).click();
  await expect(page.getByText(/Voucer sah/)).toBeVisible();
});

test("promo & scan: nominal diskon dan minimal belanja bisa diketik bebas, validasi jelas", async ({ page, request }) => {
  await uiLogin(page, "mitra@lokawira.demo", "/merchant-pos");
  await page.getByRole("tab", { name: /Promo & Scan/ }).click();

  const amount = page.getByRole("textbox", { name: "Potongan harga" });
  const min = page.getByRole("textbox", { name: "Minimal belanja" });
  await amount.fill("12500");
  await expect(amount).toHaveValue("12.500");
  await min.fill("40000");

  // terlalu kecil ditolak dgn pesan
  await amount.fill("500");
  await page.getByRole("button", { name: "Simpan voucer" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /Potongan harus antara/ })).toBeVisible();

  await amount.fill("12500");
  await page.getByRole("button", { name: "Simpan voucer" }).click();
  await expect(page.getByText(/Voucer tersimpan/)).toBeVisible();

  const spots = (await (await request.get("/api/spots", { headers: bearer(await apiLogin(request, "mitra@lokawira.demo")) })).json()).spots;
  const mine = spots.find((s: { id: string }) => s.id === "spot-mjp-02");
  expect(mine.quest.voucherReward.discountAmount).toBe(12500);
  expect(mine.quest.voucherReward.minimumSpend).toBe(40000);
});

test("promo & scan: mitra mengunggah dan menghapus foto contoh objek", async ({ page }) => {
  await uiLogin(page, "mitra@lokawira.demo", "/merchant-pos");
  await page.getByRole("tab", { name: /Promo & Scan/ }).click();

  await page.locator('input[type="file"]').setInputFiles({ name: "contoh.png", mimeType: "image/png", buffer: makePng(300, 220, true) });
  await expect(page.getByRole("img", { name: "Foto contoh 1" })).toBeVisible();
  await expect(page.getByText(/foto tersimpan/)).toBeVisible();

  await page.getByRole("button", { name: "Hapus foto contoh 1" }).click();
  await expect(page.getByRole("img", { name: "Foto contoh 1" })).toHaveCount(0);
});

test("daftar lapak: cari alamat dan pakai lokasi sekarang menaruh pin", async ({ browser }) => {
  const ctx = await browser.newContext({ permissions: ["geolocation"], geolocation: { latitude: -7.5682, longitude: 112.3987, accuracy: 12 }, viewport: { width: 390, height: 900 } });
  const page = await ctx.newPage();
  await page.route("**/nominatim.openstreetmap.org/**", (r) =>
    r.fulfill({ json: [{ display_name: "Trowulan, Mojokerto, Jawa Timur, Indonesia", name: "Trowulan", lat: "-7.5328", lon: "112.4053" }] })
  );
  await uiLogin(page, "mitra@lokawira.demo", "/merchant-pos");
  await page.getByRole("tab", { name: /Lapak Saya/ }).click();

  await page.getByLabel("Cari alamat atau nama tempat").fill("Trowulan");
  await page.getByRole("button", { name: "Cari", exact: true }).click();
  await page.getByRole("button", { name: /Trowulan/ }).first().click();
  await expect(page.getByText(/Pin ditaruh di Trowulan/)).toBeVisible();

  await page.getByRole("button", { name: "Pakai lokasiku sekarang" }).click();
  await page.getByRole("button", { name: "Izinkan", exact: true }).click();
  await expect(page.getByText(/Pin ditaruh di lokasimu sekarang/)).toBeVisible();
  await ctx.close();
});

test("dasbor mitra lolos aksesibilitas di tiga tab", async ({ page }) => {
  await uiLogin(page, "mitra@lokawira.demo", "/merchant-pos");
  for (const name of [/Kasir/, /Promo & Scan/, /Lapak Saya/]) {
    await page.getByRole("tab", { name }).click();
    await page.waitForTimeout(800);
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).exclude("nextjs-portal").analyze();
    expect(r.violations.map((v) => `${String(name)}: ${v.id} (${v.nodes.length})`)).toEqual([]);
  }
});
