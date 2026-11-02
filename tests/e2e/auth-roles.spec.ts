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
