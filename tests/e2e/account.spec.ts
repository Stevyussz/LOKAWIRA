import { test, expect } from "@playwright/test";
import { apiLogin, bearer, uniq } from "./helpers";

test("akun demo bawaan tidak bisa diganti sandinya atau dihapus", async ({ request }) => {
  const t = await apiLogin(request, "admin@lokawira.demo");
  const ch = await request.post("/api/auth/change-password", { headers: bearer(t), data: { currentPassword: "demo1234", newPassword: "hacked1234" } });
  expect(ch.status()).toBe(403);
  const del = await request.delete("/api/me", { headers: bearer(t), data: { password: "demo1234" } });
  expect(del.status()).toBe(403);
});

test("ganti sandi, lupa sandi, dan hapus akun (API)", async ({ request }) => {
  const email = `${uniq("akun")}@uji.id`;
  const reg = await (await request.post("/api/auth/register", { data: { name: "Uji Akun", email, password: "rahasia123", role: "VISITOR" } })).json();

  const bad = await request.post("/api/auth/change-password", { headers: bearer(reg.token), data: { currentPassword: "salah", newPassword: "baru12345" } });
  expect(bad.status()).toBe(401);
  const ok = await request.post("/api/auth/change-password", { headers: bearer(reg.token), data: { currentPassword: "rahasia123", newPassword: "baru12345" } });
  expect(ok.ok()).toBeTruthy();
  // sesi lama dicabut
  expect((await request.get("/api/auth/me", { headers: bearer(reg.token) })).status()).toBe(401);

  const unknown = await (await request.post("/api/auth/forgot-password", { data: { email: "tidakada@x.id" } })).json();
  expect(unknown).toEqual({ ok: true });
  const forgot = await (await request.post("/api/auth/forgot-password", { data: { email } })).json();
  const reset = await request.post("/api/auth/reset-password", { data: { token: forgot.demoToken, password: "lagi123456" } });
  expect(reset.ok()).toBeTruthy();
  const again = await request.post("/api/auth/reset-password", { data: { token: forgot.demoToken, password: "lagi123456" } });
  expect((await again.json()).code).toBe("TOKEN_INVALID_OR_EXPIRED");

  const t = await apiLogin(request, email, "lagi123456");
  expect((await request.delete("/api/me", { headers: bearer(t), data: { password: "salah" } })).status()).toBe(401);
  expect((await request.delete("/api/me", { headers: bearer(t), data: { password: "lagi123456" } })).ok()).toBeTruthy();
  const gone = await request.post("/api/auth/login", { data: { email, password: "lagi123456" } });
  expect(gone.status()).toBe(401);
});
