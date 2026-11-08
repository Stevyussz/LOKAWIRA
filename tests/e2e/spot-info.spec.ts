import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { apiLogin, bearer, makePng } from "./helpers";

// sheet Info tiap titik: deskripsi, galeri, peraturan, kontak. Diisi mitra pemilik / pengelola

test("API info tempat: validasi, galeri maks 6, foto titik orang lain ditolak, mitra lain 403", async ({ request }) => {
  const mitra = await apiLogin(request, "mitra@lokawira.demo");
  const admin = await apiLogin(request, "admin@lokawira.demo");
  const id = "spot-mjp-03";

  expect((await request.patch(`/api/spots/${id}`, { headers: bearer(mitra), data: { rules: Array.from({ length: 9 }, (_, i) => `Aturan ${i}`) } })).status()).toBe(400);
  expect((await request.patch(`/api/spots/${id}`, { headers: bearer(mitra), data: { description: "x".repeat(401) } })).status()).toBe(400);
  const ok = await request.patch(`/api/spots/${id}`, { headers: bearer(mitra), data: { description: "Warung keluarga sejak 1980.", rules: ["  Antre di depan kasir  ", ""], contact: "WA 0812 0000 0000" } });
  expect(ok.status()).toBe(200);
  const spot = (await ok.json()).spot;
  expect(spot.description).toBe("Warung keluarga sejak 1980.");
  expect(spot.rules).toEqual(["Antre di depan kasir"]);
  // info tempat gak bikin lapak balik ditinjau
  expect(spot.status ?? "PUBLISHED").toBe("PUBLISHED");

  // galeri: cuma pemilik/pengelola, format dicek, maks 6
  expect((await request.post(`/api/spots/spot-mjp-01/gallery`, { headers: bearer(mitra), multipart: { image: { name: "a.png", mimeType: "image/png", buffer: makePng(40, 40, false) } } })).status()).toBe(403);
  expect((await request.post(`/api/spots/${id}/gallery`, { headers: bearer(mitra), multipart: { image: { name: "a.txt", mimeType: "text/plain", buffer: Buffer.from("x") } } })).status()).toBe(415);
  const ids: string[] = [];
  for (let i = 0; i < 6; i++) {
    const r = await request.post(`/api/spots/${id}/gallery`, { headers: bearer(mitra), multipart: { caption: `Sudut ${i + 1}`, image: { name: "a.png", mimeType: "image/png", buffer: makePng(60, 40, false) } } });
    expect(r.status()).toBe(200);
    const g = (await r.json()).gallery;
    ids.push(g[g.length - 1].id);
  }
  expect((await request.post(`/api/spots/${id}/gallery`, { headers: bearer(mitra), multipart: { image: { name: "a.png", mimeType: "image/png", buffer: makePng(60, 40, false) } } })).status()).toBe(409);
  const pub = (await (await request.get("/api/spots")).json()).spots.find((s: { id: string }) => s.id === id);
  expect(pub.gallery).toHaveLength(6);
  expect(pub.gallery[0].caption).toBe("Sudut 1");
  const img = await request.get(pub.gallery[0].url);
  expect(img.status()).toBe(200);
  expect(img.headers()["content-type"]).toBe("image/png");

  for (const g of ids) expect((await request.delete(`/api/spots/${id}/gallery/${g}`, { headers: bearer(admin) })).status()).toBe(200);
  await request.patch(`/api/spots/${id}`, { headers: bearer(mitra), data: { description: "", rules: [], contact: "" } });
});

test("API: mitra mengubah cerita = lapak ditinjau ulang; nama objek scan tidak", async ({ request }) => {
  const mitra = await apiLogin(request, "mitra@lokawira.demo");
  const admin = await apiLogin(request, "admin@lokawira.demo");
  const id = "spot-mjp-03";
  const before = (await (await request.get("/api/spots")).json()).spots.find((s: { id: string }) => s.id === id);

  const target = await request.patch(`/api/spots/${id}`, { headers: bearer(mitra), data: { quest: { targetObjectPrompt: "Cobek batu di meja depan" } } });
  expect((await target.json()).spot.status ?? "PUBLISHED").toBe("PUBLISHED");

  const story = await request.patch(`/api/spots/${id}`, { headers: bearer(mitra), data: { quest: { loreNarrative: "Cerita baru yang belum diperiksa pengelola." } } });
  expect((await story.json()).spot.status).toBe("PENDING_REVIEW");
  expect((await (await request.get("/api/spots")).json()).spots.some((s: { id: string }) => s.id === id)).toBe(false);

  // kembalikan seperti semula
  await request.patch(`/api/spots/${id}`, { headers: bearer(admin), data: { quest: { loreNarrative: before.quest.loreNarrative, targetObjectPrompt: before.quest.targetObjectPrompt } } });
  expect((await request.post(`/api/admin/spots/${id}/review`, { headers: bearer(admin), data: { decision: "PUBLISH" } })).status()).toBe(200);
});

test("UI: sheet Info menampilkan deskripsi, galeri, peraturan, kontak, dan lolos aksesibilitas", async ({ page, request }) => {
  const mitra = await apiLogin(request, "mitra@lokawira.demo");
  const id = "spot-mjp-02";
  await request.patch(`/api/spots/${id}`, { headers: bearer(mitra), data: { description: "Sanggar terakota yang membuka kelas untuk umum.", rules: ["Lepas alas kaki di pendapa", "Tanya dulu sebelum memotret perajin"], contact: "WA 0812 1111 2222" } });
  const up = await request.post(`/api/spots/${id}/gallery`, { headers: bearer(mitra), multipart: { caption: "Ruang kelas tanah liat", image: { name: "a.png", mimeType: "image/png", buffer: makePng(120, 90, true) } } });
  const galleryId = (await up.json()).gallery.at(-1).id as string;

  await page.goto(`/?titik=${id}`);
  await page.getByRole("button", { name: "Info", exact: true }).click();
  const info = page.getByRole("dialog");
  await expect(info.getByRole("heading", { name: /Sanggar/ })).toBeVisible();
  await expect(info.getByText("Sanggar terakota yang membuka kelas untuk umum.")).toBeVisible();
  await expect(info.getByRole("img", { name: "Ruang kelas tanah liat" })).toBeVisible();
  await expect(info.getByRole("heading", { name: "Peraturan pengunjung" })).toBeVisible();
  await expect(info.getByRole("listitem").filter({ hasText: "Lepas alas kaki di pendapa" })).toBeVisible();
  await expect(info.getByText("WA 0812 1111 2222")).toBeVisible();
  await expect(info.getByRole("link", { name: "Buka di Google Maps" })).toHaveAttribute("href", /google\.com\/maps/);

  const axe = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
  expect(axe.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await request.delete(`/api/spots/${id}/gallery/${galleryId}`, { headers: bearer(mitra) });
  await request.patch(`/api/spots/${id}`, { headers: bearer(mitra), data: { description: "", rules: [], contact: "" } });
});

test("API reservasi: pengalihan cuma saat padat & ke lapak lain, slot penuh ditolak", async ({ request }) => {
  const admin = await apiLogin(request, "admin@lokawira.demo");
  const reg = await request.post("/api/auth/register", { data: { name: "Pemesan Uji", email: `slot${Date.now()}@uji.id`, password: "rahasia123", role: "VISITOR" } });
  const v = (await reg.json()).token as string;
  const id = "spot-mjp-01";
  const spot = (await (await request.get("/api/spots")).json()).spots.find((s: { id: string }) => s.id === id);
  const slot = `Uji-${Date.now()}`;
  const reserve = (data: Record<string, unknown>) => request.post("/api/reservations", { headers: bearer(v), data: { spotId: id, visitorName: "Uji", scheduledSlot: slot, ...data } });

  // kapasitas dikecilkan sementara biar padat & penuhnya bisa diuji pasti
  await request.patch(`/api/spots/${id}`, { headers: bearer(admin), data: { quota: { maxCapacity: 5 } } });
  try {
    // tidak padat: misi pengalihan diabaikan
    await request.patch(`/api/spots/${id}/quota`, { headers: bearer(admin), data: { currentVisitors: 0 } });
    const calm = await (await reserve({ partySize: 1, acceptCircularQuest: true })).json();
    expect(calm.bonusVoucher).toBeUndefined();
    expect(calm.rewardNote).toBe("NOT_CROWDED");

    // padat (5/5): voucer dari lapak LAIN, bkn tempat ini
    await request.patch(`/api/spots/${id}/quota`, { headers: bearer(admin), data: { currentVisitors: 5 } });
    const busy = await (await reserve({ partySize: 1, acceptCircularQuest: true })).json();
    expect(busy.bonusVoucher?.spotId).toBeTruthy();
    expect(busy.bonusVoucher.spotId).not.toBe(id);

    // slot berisi 2 orang, kapasitas 5: 4 orang lagi ditolak, 3 masih muat
    const full = await reserve({ partySize: 4 });
    expect(full.status()).toBe(409);
    const body = await full.json();
    expect(body.code).toBe("SLOT_FULL");
    expect(body.details.remaining).toBe(3);
    expect((await reserve({ partySize: 3 })).status()).toBe(200);
  } finally {
    await request.patch(`/api/spots/${id}`, { headers: bearer(admin), data: { quota: { maxCapacity: spot.quota.maxCapacity } } });
    await request.patch(`/api/spots/${id}/quota`, { headers: bearer(admin), data: { currentVisitors: spot.quota.currentVisitors } });
  }
});
