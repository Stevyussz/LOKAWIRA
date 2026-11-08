import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { apiLogin, bearer, newVisitor, uiLogin } from "./helpers";

// Loka: tanya-jawab wisatawan (rujukan + data lapak), bantu tulis mitra, alat pengelola.
// Server tes gak punya kunci AI, jadi yg diuji di sini jalur offline yg harus tetap berguna & jujur

test("Tanya Loka menjawab hal praktis dari data lapak, petunjuk misi tetap kurasi", async ({ request }) => {
  const spot = (await (await request.get("/api/spots")).json()).spots.find((s: { id: string }) => s.id === "spot-mjp-01");
  const ask = async (q: string, history?: { q: string; a: string }[]) =>
    (await request.post("/api/ai/storyteller", { data: { spotId: spot.id, customQuestion: q, history } })).json();

  const ev = await ask("Ada acara apa minggu ini?");
  expect(ev.sourceMode).toBe("OFFLINE");
  expect(ev.answered).toBe(true);
  expect(ev.answer).toMatch(/Acara berikutnya|Belum ada acara/);
  expect(ev.references).toEqual(["Data lapak di LOKAWIRA (diisi pemilik)"]);
  expect(ev.riddle).toBe(spot.quest.riddleClue);
  expect(Array.isArray(ev.followUps)).toBe(true);

  const entry = await ask("Berapa harga tiketnya?", [{ q: "Ada acara apa?", a: ev.answer }]);
  expect(entry.answer).toMatch(/^Cara masuk:/);

  const near = await ask("Ada tempat lain di dekat sini?");
  expect(near.answer).toMatch(/Titik terdekat:/);

  // tanpa pertanyaan = narasi kurasi
  const intro = await (await request.post("/api/ai/storyteller", { data: { spotId: spot.id } })).json();
  expect(intro.sourceMode).toBe("CURATED");
  expect(intro.answer).toBe(spot.quest.loreNarrative);

  expect((await request.post("/api/ai/storyteller", { data: { spotId: "spot-tidak-ada", customQuestion: "halo?" } })).status()).toBe(404);
});

test("pertanyaan yang belum terjawab dicatat tanpa identitas dan bisa ditandai beres oleh pengelola", async ({ request }) => {
  const { token } = await newVisitor(request);
  const q = "Siapa arsitek kuncup zirkonia itu? 0812 3456 7890";
  const res = await (await request.post("/api/ai/storyteller", { headers: bearer(token), data: { spotId: "spot-mjp-01", customQuestion: q } })).json();
  expect(res.answered).toBe(false);
  expect(res.answer).toMatch(/belum ada/);

  expect((await request.get("/api/ai/gaps")).status()).toBe(401);
  const mitra = await apiLogin(request, "mitra@lokawira.demo");
  expect((await request.get("/api/ai/gaps", { headers: bearer(mitra) })).status()).toBe(403);
  const admin = await apiLogin(request, "admin@lokawira.demo");
  const gaps = (await (await request.get("/api/ai/gaps", { headers: bearer(admin) })).json()).gaps;
  const g = gaps.find((x: { spotId: string }) => x.spotId === "spot-mjp-01");
  expect(g.count).toBeGreaterThanOrEqual(1);
  const sample = g.samples.find((s: string) => s.includes("zirkonia"));
  expect(sample).toContain("[disamarkan]");
  expect(sample).not.toContain("0812");
  const after = (await (await request.delete("/api/ai/gaps/spot-mjp-01", { headers: bearer(admin) })).json()).gaps;
  expect(after.find((x: { spotId: string }) => x.spotId === "spot-mjp-01")).toBeFalsy();
});

test("Loka bantu mitra: rapikan info tempat & saran petunjuk, hanya untuk lapak sendiri", async ({ request }) => {
  const mitra = await apiLogin(request, "mitra@lokawira.demo");
  // spot-mjp-03 milik akun mitra demo
  const own = { id: "spot-mjp-03" };

  const r = await request.post("/api/ai/assist", {
    headers: bearer(mitra),
    data: { task: "polish-info", spotId: own.id, notes: "jual wedang pokak hangat dan sambel wader\n- antre di depan kasir\n- jangan buang sampah di sungai" },
  });
  expect(r.status()).toBe(200);
  const body = await r.json();
  expect(body.mode).toBe("OFFLINE");
  expect(body.description).toMatch(/^Jual wedang pokak/);
  expect(body.rules).toEqual(["Antre di depan kasir", "Jangan buang sampah di sungai"]);

  expect((await request.post("/api/ai/assist", { headers: bearer(mitra), data: { task: "polish-info", spotId: own.id, notes: "pendek" } })).status()).toBe(400);
  expect((await request.post("/api/ai/assist", { headers: bearer(mitra), data: { task: "polish-info", spotId: "spot-mjp-01", notes: "lapak orang lain ini panjang sekali" } })).status()).toBe(403);
  expect((await request.post("/api/ai/assist", { data: { task: "polish-info", notes: "tanpa login tidak boleh ya" } })).status()).toBe(401);
  const { token } = await newVisitor(request);
  expect((await request.post("/api/ai/assist", { headers: bearer(token), data: { task: "polish-info", notes: "wisatawan tidak boleh pakai" } })).status()).toBe(403);

  const clue = await (await request.post("/api/ai/assist", { headers: bearer(mitra), data: { task: "suggest-clue", spotId: own.id } })).json();
  expect(clue.clues.length).toBeGreaterThanOrEqual(2);
});

test("alat pengelola: periksa pengajuan dan pecah teks sumber jadi draf rujukan", async ({ request }) => {
  const admin = await apiLogin(request, "admin@lokawira.demo");
  const review = await (await request.post("/api/ai/review/spot-mjp-02", { headers: bearer(admin) })).json();
  expect(review.mode).toBe("OFFLINE");
  expect(Array.isArray(review.checks)).toBe(true);
  for (const c of review.checks) expect(["BLOCK", "WARN", "INFO"]).toContain(c.level);

  const mitra = await apiLogin(request, "mitra@lokawira.demo");
  expect((await request.post("/api/ai/review/spot-mjp-02", { headers: bearer(mitra) })).status()).toBe(403);

  const text =
    "Kotagede berdiri sebagai ibu kota Mataram Islam pada abad ke-16. Kompleks makam dan Sendang Seliran dijaga abdi dalem. Pengunjung wajib memakai kain jarik saat memasuki kompleks makam. Kerajinan perak filigri berkembang di kampung-kampung sekitarnya.";
  const ex = await (await request.post("/api/ai/extract-notes", { headers: bearer(admin), data: { text, opkCategory: "Adat Istiadat" } })).json();
  expect(ex.mode).toBe("OFFLINE");
  expect(ex.drafts.length).toBeGreaterThanOrEqual(1);
  expect(ex.drafts[0].opkCategory).toBe("Adat Istiadat");
  expect(ex.drafts.map((d: { summary: string }) => d.summary).join(" ")).toContain("abad ke-16");
  expect((await request.post("/api/ai/extract-notes", { headers: bearer(admin), data: { text: "pendek", opkCategory: "Ritus" } })).status()).toBe(400);
  expect((await request.post("/api/ai/extract-notes", { headers: bearer(admin), data: { text, opkCategory: "Bukan OPK" } })).status()).toBe(400);
  expect((await request.post("/api/ai/extract-notes", { headers: bearer(mitra), data: { text, opkCategory: "Ritus" } })).status()).toBe(403);
});

test("UI: wisatawan bertanya lewat saran pertanyaan dan jawabannya bersumber", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Kisah" }).click();
  const dock = page.getByRole("complementary", { name: "Loka, pemandu AI" });
  await expect(dock).toBeVisible();
  await dock.getByRole("button", { name: "Tanya Loka" }).click();
  const chips = dock.getByRole("list", { name: "Saran pertanyaan" });
  await expect(chips).toBeVisible();
  await chips.getByRole("button").first().click();
  const thread = dock.getByRole("list", { name: "Percakapan dengan Loka" });
  await expect(thread.getByText("Dari catatan tersimpan")).toBeVisible();
  await dock.getByLabel("Pertanyaan untuk Loka").fill("Ada aturan apa di sini?");
  await dock.getByRole("button", { name: "Kirim pertanyaan" }).click();
  await expect(thread.getByRole("listitem")).toHaveCount(2);
  const axe = await new AxeBuilder({ page }).include('[aria-label="Loka, pemandu AI"]').withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations.map((v) => `${v.id} (${v.nodes.length})`)).toEqual([]);
});

test("UI: mitra melihat Saran Loka dan memakai hasil rapikan di Info tempat", async ({ page }) => {
  await uiLogin(page, "mitra@lokawira.demo", "/merchant-pos");
  await expect(page.getByRole("heading", { name: "Saran Loka untuk lapakmu" })).toBeVisible();
  await page.getByRole("tab", { name: /Lapak Saya/ }).click();
  await page.getByRole("button", { name: /^Ubah / }).first().click();
  const sheet = page.getByRole("dialog");
  await sheet.getByRole("button", { name: "Bantu tulis dengan Loka" }).click();
  await sheet.getByLabel("Ceritakan lapakmu dengan bebas").fill("menjual wedang pokak hangat buatan keluarga\n- antre di depan kasir");
  await sheet.getByRole("button", { name: "Rapikan" }).click();
  await sheet.getByRole("button", { name: "Pakai hasil ini" }).click();
  await expect(sheet.getByLabel("Deskripsi singkat")).toHaveValue(/^Menjual wedang pokak/);
  await expect(sheet.getByLabel(/Peraturan pengunjung/)).toHaveValue("Antre di depan kasir");
  const axe = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations.map((v) => `${v.id} (${v.nodes.length})`)).toEqual([]);
});

test("UI: pengelola melihat pertanyaan belum terjawab dan pemecah teks sumber", async ({ page, request }) => {
  await request.post("/api/ai/storyteller", { data: { spotId: "spot-sgn-01", customQuestion: "Berapa jumlah ubin obsidian zamrud?" } });
  await uiLogin(page, "admin@lokawira.demo", "/admin");
  await page.getByRole("tab", { name: "Pengetahuan Loka" }).click();
  const gaps = page.getByRole("region", { name: "Pertanyaan yang belum bisa dijawab Loka" });
  await expect(gaps.getByText(/ubin obsidian/)).toBeVisible();
  await gaps.getByRole("button", { name: "Tulis rujukan" }).first().click();
  await expect(page.getByText(/Untuk menjawab pertanyaan di/)).toBeVisible();
  await expect(page.getByRole("region", { name: "Ambil rujukan dari teks sumber" })).toBeVisible();
  const axe = await new AxeBuilder({ page }).include("main").withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations.map((v) => `${v.id} (${v.nodes.length})`)).toEqual([]);
});
