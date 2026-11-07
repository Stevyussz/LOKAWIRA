import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { apiLogin, bearer, uiLogin, uniq } from "./helpers";

// kawasan sbg data: dibuat pengelola, lapak masuk kawasan otomatis dr lokasi pin

test("API kawasan: publik cuma aktif, validasi, lapak di luar kawasan ikut masuk saat kawasan dibuat", async ({ request }) => {
  const admin = await apiLogin(request, "admin@lokawira.demo");
  const mitra = await apiLogin(request, "mitra@lokawira.demo");
  const pub = (await (await request.get("/api/regions")).json()).regions as { id: string; status: string }[];
  expect(pub.length).toBeGreaterThanOrEqual(5);
  expect(pub.every((r) => r.status === "ACTIVE")).toBe(true);
  const snap = await (await request.get("/api/spots")).json();
  expect(snap.regions.length).toBe(pub.length);

  // validasi
  const base = { name: uniq("Kawasan"), label: "Tanjung Bumi, Bangkalan", theme: "bahari", center: { lat: -6.88, lng: 112.95 }, radiusKm: 8, status: "ACTIVE" };
  for (const bad of [{ radiusKm: 0 }, { center: { lat: 35.6, lng: 139.7 } }, { theme: "neon" }, { name: "AB" }]) {
    expect((await request.post("/api/regions", { headers: bearer(admin), data: { ...base, ...bad } })).status()).toBe(400);
  }
  expect((await request.post("/api/regions", { headers: bearer(mitra), data: base })).status()).toBe(403);

  // mitra daftar lapak di lokasi yg belum ada kawasannya
  const tpl = snap.spots.find((s: { spotType: string }) => s.spotType !== "PRIMARY_DEST");
  const lapak = { ...tpl, name: uniq("Lapak Batik Tanjung"), coordinates: { lat: -6.885, lng: 112.955 }, regionProposal: "Kampung Batik Tanjung Bumi", vibe: "majapahit", regionName: "palsu" };
  const added = (await (await request.post("/api/spots", { headers: bearer(mitra), data: lapak })).json()).spot;
  expect(added.regionId).toBeUndefined();
  expect(added.regionProposal).toBe("Kampung Batik Tanjung Bumi");
  expect(added.regionName).toBe("Di luar kawasan");

  // belum ada kawasan: gak bisa terbit
  const pub1 = await request.post(`/api/admin/spots/${added.id}/review`, { headers: bearer(admin), data: { decision: "PUBLISH" } });
  expect(pub1.status()).toBe(409);
  expect((await pub1.json()).code).toBe("NO_REGION");
  // pengelola juga gak bisa naruh titik resmi di luar kawasan
  const adminOut = await request.post("/api/spots", { headers: bearer(admin), data: { ...tpl, name: uniq("Titik Luar"), coordinates: { lat: -0.5, lng: 101.4 } } });
  expect((await adminOut.json()).code).toBe("OUT_OF_REGION");

  // kawasan dibuat: lapak tadi otomatis masuk
  const created = await request.post("/api/regions", { headers: bearer(admin), data: base });
  expect(created.status()).toBe(201);
  const cj = await created.json();
  expect(cj.adopted).toBeGreaterThanOrEqual(1);
  const dup = await request.post("/api/regions", { headers: bearer(admin), data: base });
  expect(dup.status()).toBe(409);

  const mine = (await (await request.get("/api/spots", { headers: bearer(mitra) })).json()).spots.find((s: { id: string }) => s.id === added.id);
  expect(mine.regionId).toBe(cj.region.id);
  expect(mine.vibe).toBe("bahari");
  expect((await request.post(`/api/admin/spots/${added.id}/review`, { headers: bearer(admin), data: { decision: "PUBLISH" } })).ok()).toBeTruthy();
  const publicIds = (await (await request.get(`/api/spots?regionId=${cj.region.id}`)).json()).spots.map((s: { id: string }) => s.id);
  expect(publicIds).toContain(added.id);

  // ganti palet kawasan: titiknya ikut; jadi draf: titiknya hilang dr publik
  await request.patch(`/api/regions/${cj.region.id}`, { headers: bearer(admin), data: { theme: "tridatu", status: "DRAFT" } });
  const after = (await (await request.get("/api/spots", { headers: bearer(admin) })).json()).spots.find((s: { id: string }) => s.id === added.id);
  expect(after.vibe).toBe("tridatu");
  expect((await (await request.get("/api/spots")).json()).spots.map((s: { id: string }) => s.id)).not.toContain(added.id);
  expect((await (await request.get("/api/regions")).json()).regions.map((r: { id: string }) => r.id)).not.toContain(cj.region.id);
});

test("UI: pemilih kawasan di peta memakai data server, tab Kawasan pengelola aksesibel", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /^Pilih titik / }).first()).toBeVisible({ timeout: 20000 });
  await page.locator('[aria-haspopup="true"]').first().click();
  await page.getByRole("button", { name: /Mataraman/ }).first().click();
  await expect(page.getByRole("region", { name: /Peta eksplorasi budaya Mataraman, Kotagede/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Pilih titik .*Kotagede/ }).first()).toBeVisible({ timeout: 10000 });

  await uiLogin(page, "admin@lokawira.demo", "/admin");
  await page.getByRole("tab", { name: /Kawasan/ }).click();
  await expect(page.getByRole("heading", { name: /Kawasan budaya \(\d+\)/ })).toBeVisible();
  await page.getByRole("button", { name: "Ubah kawasan Majapahit" }).click();
  await expect(page.getByLabel("Nama kawasan")).toHaveValue("Majapahit");
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).exclude("nextjs-portal").analyze();
  expect(axe.violations.map((v) => `${v.id} (${v.nodes.length})`)).toEqual([]);
});
