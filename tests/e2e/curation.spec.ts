import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { apiLogin, bearer } from "./helpers";

test("pin di luar Indonesia ditolak saat tambah dan ubah titik", async ({ request }) => {
  const admin = await apiLogin(request, "admin@lokawira.demo");
  const base = (await (await request.get("/api/spots")).json()).spots[0];
  const draft = { ...base, name: "Titik Luar Negeri", coordinates: { lat: 1.29, lng: 103.0 - 20 } };
  const add = await request.post("/api/spots", { headers: bearer(admin), data: draft });
  expect(add.status()).toBe(400);
  expect((await add.json()).code).toBe("OUT_OF_INDONESIA");
  const move = await request.patch(`/api/spots/${base.id}`, { headers: bearer(admin), data: { coordinates: { lat: 35.68, lng: 139.69 } } });
  expect((await move.json()).code).toBe("OUT_OF_INDONESIA");
});

test("rujukan Pengetahuan Loka dipakai Loka dan disebut sumbernya", async ({ request }) => {
  const admin = await apiLogin(request, "admin@lokawira.demo");
  const spot = (await (await request.get("/api/spots")).json()).spots[0];
  const add = await request.post("/api/ai-notes", {
    headers: bearer(admin),
    data: { opkCategory: spot.opkCategory, maestroSource: "Juru Pelihara Uji Rujukan", summary: "Gerbang paduraksa terakota dipugar ulang memakai bata asli; pola susun batanya diwariskan para tukang lokal." },
  });
  expect(add.status()).toBe(201);
  const res = await (await request.post("/api/ai/storyteller", { data: { spotId: spot.id, customQuestion: "bagaimana gerbang paduraksa terakota dipugar?" } })).json();
  expect(res.references).toContain("Juru Pelihara Uji Rujukan");
  expect(res.story).toMatch(/paduraksa/i);
});

test("halaman panduan menguji untuk Tim Kurasi tampil dan aksesibel", async ({ page }) => {
  await page.goto("/panduan-uji");
  await expect(page.getByRole("heading", { name: "Panduan menguji LOKAWIRA" })).toBeVisible();
  for (const h of ["Wisatawan", "Mitra (UMKM dan sanggar)", "Pengelola"]) await expect(page.getByRole("heading", { name: h })).toBeVisible();
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).exclude("nextjs-portal").analyze();
  expect(axe.violations.map((v) => `${v.id} (${v.nodes.length})`)).toEqual([]);
});
