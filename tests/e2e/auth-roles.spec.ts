import { test, expect } from "@playwright/test";
import { uiLogin } from "./helpers";

test("tamu yang membuka /admin diarahkan ke halaman masuk", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/masuk\?next=/);
});

test("mitra masuk ke dasbor mitra, tapi tidak punya akses ke /admin", async ({ page }) => {
  await uiLogin(page, "mitra@lokawira.demo", "/merchant-pos");
  await expect(page.getByRole("heading", { name: "Dasbor Mitra" })).toBeVisible();
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Dasbor Pengelola" })).toBeHidden();
});

test("pengelola melihat tab Persetujuan", async ({ page }) => {
  await uiLogin(page, "admin@lokawira.demo", "/admin");
  await expect(page.getByRole("tab", { name: /Persetujuan/ })).toBeVisible();
});

test("sandi salah ditolak dengan pesan", async ({ page }) => {
  await uiLogin(page, "mitra@lokawira.demo", "/merchant-pos", "salah-salah-salah");
  await expect(page.getByRole("alert").filter({ hasText: /\S/ }).first()).toBeVisible();
});

test("daftar: bawaan Wisatawan, ?role=mitra memilih Mitra, dan akun pengelola tidak bisa didaftarkan", async ({ page }) => {
  await page.goto("/masuk?mode=daftar");
  await expect(page.getByRole("radio", { name: /Wisatawan/ })).toBeChecked();
  await expect(page.getByText(/Akun pengelola dibuat oleh tim LOKAWIRA/)).toBeVisible();
  await expect(page.getByRole("radio", { name: /Pengelola/ })).toHaveCount(0);

  await page.goto("/masuk?mode=daftar&role=mitra");
  await expect(page.getByRole("radio", { name: /Mitra/ })).toBeChecked();
  await expect(page.getByText(/diperiksa pengelola dulu/)).toBeVisible();
});

test("satu halaman masuk untuk semua peran: tiap akun diarahkan ke dasbornya", async ({ browser }) => {
  for (const [email, path] of [["admin@lokawira.demo", /\/admin/], ["mitra@lokawira.demo", /\/merchant-pos/], ["wisatawan@lokawira.demo", /\/$/]] as const) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto("/masuk");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Kata sandi").fill("demo1234");
    await page.getByRole("button", { name: "Masuk", exact: true }).last().click();
    await expect(page).toHaveURL(path);
    await ctx.close();
  }
});
