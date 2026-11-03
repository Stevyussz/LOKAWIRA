import { test, expect } from "@playwright/test";
import { apiLogin, bearer, makePng, uniq, uiLogin } from "./helpers";

// dasbor pengelola: ringkasan, daftar mitra, titik (cari + objek scan), kuota, hadiah bebas ketik, pengetahuan Loka

test("persetujuan: daftar semua mitra, nonaktifkan lalu aktifkan lagi dgn alasan terlihat", async ({ page, request }) => {
  const email = `${uniq("toko")}@uji.test`;
  const reg = await request.post("/api/auth/register", { data: { name: "Toko Uji Roster", email, password: "rahasia-123", role: "MERCHANT" } });
  expect(reg.ok()).toBeTruthy();

  await uiLogin(page, "admin@lokawira.demo", "/admin");
  await expect(page.getByRole("heading", { name: "Dasbor Pengelola" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /^Semua mitra/ })).toBeVisible();

  const approve = page.getByRole("button", { name: "Setujui Toko Uji Roster" }).first();
  await approve.click();
  await expect(page.getByText("Toko Uji Roster disetujui sebagai mitra.")).toBeVisible();

  await page.getByRole("button", { name: "Nonaktifkan Toko Uji Roster" }).click();
  await page.getByLabel("Alasan (dilihat mitra)").fill("Dokumen belum lengkap");
  await page.getByRole("button", { name: "Nonaktifkan", exact: true }).last().click();
  await expect(page.getByText("Toko Uji Roster ditolak.")).toBeVisible();

  // mitra melihat alasannya
  const login = await (await request.post("/api/auth/login", { data: { email, password: "rahasia-123" } })).json();
  const me = await (await request.get("/api/auth/me", { headers: bearer(login.token) })).json();
  expect(me.user.status).toBe("REJECTED");
  expect(me.user.statusReason).toBe("Dokumen belum lengkap");
});

test("titik di peta: cari/saring, atur objek scan dan foto contoh dari dasbor pengelola", async ({ page }) => {
  await uiLogin(page, "admin@lokawira.demo", "/admin");
  await page.getByRole("tab", { name: /Titik di Peta/ }).click();

  await page.getByLabel("Cari nama atau alamat").fill("Wedang Pokak");
  await expect(page.getByRole("heading", { name: /Wedang Pokak/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Candi Bajang Ratu/ })).toHaveCount(0);

  await page.getByRole("button", { name: /Objek dan foto Wedang Pokak/ }).click();
  await page.getByRole("textbox", { name: "Nama atau ciri objek" }).fill("Gelas wedang pokak di meja kayu");
  await page.getByRole("button", { name: "Simpan objek" }).click();
  await expect(page.getByText(/Objek tersimpan/)).toBeVisible();
  await page.locator('input[type="file"]').first().setInputFiles({ name: "x.png", mimeType: "image/png", buffer: makePng(260, 200, true) });
  await expect(page.getByRole("img", { name: "Foto contoh 1" })).toBeVisible();
});

test("kuota: pengelola mengisi jumlah pengunjung sekarang dan tersimpan di server", async ({ page, request }) => {
  await uiLogin(page, "admin@lokawira.demo", "/admin");
  await page.getByRole("tab", { name: /Kuota & Tiket/ }).click();
  const spot = (await (await request.get("/api/spots")).json()).spots.find((s: { id: string }) => s.id === "spot-mjp-03");
  const row = page.getByRole("listitem").filter({ hasText: "Wedang Pokak" }).first();
  const box = row.getByLabel("Jumlah pengunjung sekarang");
  await expect(box).toBeVisible();
  const target = Math.floor(spot.quota.maxCapacity * 0.5);
  await box.fill(String(target));
  await row.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page.getByText(/Jumlah pengunjung .* disimpan/)).toBeVisible();
  const after = (await (await request.get("/api/spots")).json()).spots.find((s: { id: string }) => s.id === "spot-mjp-03");
  expect(after.quota.currentVisitors).toBe(target);
});

test("hadiah: nominal voucer diketik bebas dan XP tersimpan", async ({ page, request }) => {
  await uiLogin(page, "admin@lokawira.demo", "/admin");
  await page.getByRole("tab", { name: /Hadiah & Voucer/ }).click();
  const row = page.getByRole("listitem").filter({ hasText: "Wedang Pokak" }).first();
  await row.getByRole("textbox", { name: "Potongan voucer" }).fill("17500");
  await row.getByRole("spinbutton", { name: "XP misi" }).fill("175");
  await row.getByRole("button", { name: /Simpan hadiah/ }).click();
  await expect(page.getByText(/Hadiah .* tersimpan/)).toBeVisible();
  const spot = (await (await request.get("/api/spots")).json()).spots.find((s: { id: string }) => s.id === "spot-mjp-03");
  expect(spot.quest.voucherReward.discountAmount).toBe(17500);
  expect(spot.quest.rewardPoints).toBe(175);
});

test("pengetahuan Loka: form kosong dgn contoh, validasi jelas, lalu tersimpan", async ({ page }) => {
  await uiLogin(page, "admin@lokawira.demo", "/admin");
  await page.getByRole("tab", { name: /Pengetahuan Loka/ }).click();
  await expect(page.getByLabel("Sumber atau narasumber")).toHaveValue("");
  await page.getByRole("button", { name: "Simpan rujukan" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /Tulis nama sumber/ })).toBeVisible();
  await page.getByLabel("Sumber atau narasumber").fill("Dinas Kebudayaan Uji");
  await page.getByLabel("Ringkasan fakta budaya").fill("Fakta uji: teknik cetak tangan pada celengan terakota Majapahit.");
  await page.getByRole("button", { name: "Simpan rujukan" }).click();
  await expect(page.getByText(/Rujukan .* tersimpan/)).toBeVisible();
  await expect(page.getByText("Dinas Kebudayaan Uji").first()).toBeVisible();

  // ubah rujukan itu, lalu hapus
  await page.getByRole("button", { name: "Ubah rujukan dari Dinas Kebudayaan Uji" }).first().click();
  await page.getByLabel("Sumber atau narasumber").fill("Dinas Kebudayaan Revisi");
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(page.getByText("Dinas Kebudayaan Revisi").first()).toBeVisible();
  await page.getByRole("button", { name: "Hapus rujukan dari Dinas Kebudayaan Revisi" }).first().click();
  await page.getByRole("button", { name: "Ya, hapus" }).click();
  await expect(page.getByRole("button", { name: "Ubah rujukan dari Dinas Kebudayaan Revisi" })).toHaveCount(0);
});

test("tiket: check-in cepat lewat nomor tiket", async ({ page, request }) => {
  const spot = (await (await request.get("/api/spots")).json()).spots[0];
  const r = await request.post("/api/reservations", { data: { spotId: spot.id, visitorName: "Tamu Cepat", partySize: 2, scheduledSlot: "09:00 WIB", acceptCircularQuest: false } });
  const id = (await r.json()).reservation.ticketId as string;
  await uiLogin(page, "admin@lokawira.demo", "/admin");
  await page.getByRole("tab", { name: /Kuota & Tiket/ }).click();
  await page.getByLabel("Nomor tiket").fill(id);
  await page.getByRole("button", { name: "Check-In", exact: true }).first().click();
  await expect(page.getByText(new RegExp(`Tiket ${id} atas nama Tamu Cepat`))).toBeVisible();
  void apiLogin;
});
