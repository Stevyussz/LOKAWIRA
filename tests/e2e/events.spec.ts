import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { apiLogin, bearer, uiLogin } from "./helpers";

// agenda acara budaya: acara berulang, dikelola mitra utk lapaknya, poster QR utk orang yg cuma lewat

const wibDay = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date(iso));

test("API acara: agenda kawasan berisi acara berulang; mitra cuma bisa kelola lapaknya; validasi", async ({ request }) => {
  const agenda = await (await request.get("/api/events?regionId=rgn-majapahit&days=30")).json();
  const pentas = agenda.occurrences.filter((o: { title: string }) => o.title === "Pentas Babad Surya");
  // mingguan: 4 atau 5 kali dalam 30 hari, selang 7 hari
  expect(pentas.length).toBeGreaterThanOrEqual(4);
  expect(new Date(pentas[1].startsAt).getTime() - new Date(pentas[0].startsAt).getTime()).toBe(7 * 86400000);
  expect(agenda.events).toBeUndefined();

  const mitra = await apiLogin(request, "mitra@lokawira.demo");
  const t0 = new Date(Date.now() + 2 * 86400000);
  const body = { spotId: "spot-mjp-02", title: "Latihan terbuka uji", startsAt: t0.toISOString(), endsAt: new Date(t0.getTime() + 2 * 3600000).toISOString(), repeat: "NONE" };
  expect((await request.post("/api/events", { data: body })).status()).toBe(401);
  expect((await request.post("/api/events", { headers: bearer(mitra), data: { ...body, spotId: "spot-mjp-01" } })).status()).toBe(403);
  expect((await request.post("/api/events", { headers: bearer(mitra), data: { ...body, endsAt: body.startsAt } })).status()).toBe(400);
  expect((await request.post("/api/events", { headers: bearer(mitra), data: { ...body, endsAt: new Date(t0.getTime() + 13 * 3600000).toISOString() } })).status()).toBe(400);
  const ok = await request.post("/api/events", { headers: bearer(mitra), data: body });
  expect(ok.status()).toBe(201);
  const ev = (await ok.json()).event;
  const after = await (await request.get("/api/events?spotId=spot-mjp-02&days=7")).json();
  expect(after.occurrences.map((o: { eventId: string }) => o.eventId)).toContain(ev.id);
  expect((await request.delete(`/api/events/${ev.id}`, { headers: bearer(mitra) })).ok()).toBeTruthy();
});

test("API acara: pola 'Minggu terakhir tiap bulan' jatuh di minggu terakhir", async ({ request }) => {
  const admin = await apiLogin(request, "admin@lokawira.demo");
  // mulai Jumat depan 19.00 WIB
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + ((5 - d.getUTCDay() + 7) % 7 || 7));
  d.setUTCHours(12, 0, 0, 0);
  const created = await (await request.post("/api/events", { headers: bearer(admin), data: { spotId: "spot-mjp-03", title: "Pasar bulanan uji", startsAt: d.toISOString(), endsAt: new Date(d.getTime() + 3 * 3600000).toISOString(), repeat: "MONTHLY_LAST" } })).json();
  const list = (await (await request.get("/api/events?spotId=spot-mjp-03&days=90")).json()).occurrences.filter((o: { eventId: string }) => o.eventId === created.event.id);
  expect(list.length).toBeGreaterThanOrEqual(2);
  for (const o of list) {
    const day = wibDay(o.startsAt);
    const [y, m, dd] = day.split("-").map(Number);
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    expect(dd + 7).toBeGreaterThan(daysInMonth); // minggu terakhir
    expect(new Date(`${day}T00:00:00+07:00`).getUTCDay() === 4 || new Date(o.startsAt).getUTCDay() === 5).toBe(true); // Jumat (WIB)
  }
  await request.delete(`/api/events/${created.event.id}`, { headers: bearer(admin) });
});

test("UI: tab Agenda menampilkan acara, Ingatkan aku mengunduh kalender, kartu titik menampilkan acara berikutnya", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /^Pilih titik / }).first()).toBeVisible({ timeout: 20000 });
  // kartu cagar utama: mode ringkas pun nyebut ada acara; dibuka penuh nampilin nama acaranya
  await expect(page.getByText(/XP · Acara /)).toBeVisible();
  const expand = page.getByRole("button", { name: "Tampilkan detail lokasi" });
  if (await expand.count()) await expand.click();
  await expect(page.getByRole("button", { name: /Pentas Babad Surya/ })).toBeVisible();
  await page.locator('[data-nav-id="AGENDA"]').click();
  const dialog = page.getByRole("dialog", { name: "Agenda budaya" });
  await expect(dialog.getByText("Pentas Babad Surya").first()).toBeVisible();
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).exclude("nextjs-portal").analyze();
  expect(axe.violations.map((v) => `${v.id} (${v.nodes.length})`)).toEqual([]);
  const dl = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Ingatkan aku: Pentas Babad Surya" }).first().click();
  expect((await dl).suggestedFilename()).toMatch(/\.ics$/);
});

test("poster QR mitra & tautan ?titik= membuka titiknya langsung (termasuk pindah kawasan)", async ({ page }) => {
  await uiLogin(page, "mitra@lokawira.demo", "/poster/spot-mjp-02");
  await expect(page.getByRole("img", { name: /Kode QR menuju Sanggar Kriya/ })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/\?titik=spot-mjp-02/)).toBeVisible();

  await page.goto("/?titik=spot-sgn-01");
  await expect(page.getByRole("region", { name: /Detail lokasi Kompleks Cepuri/ })).toBeVisible({ timeout: 20000 });
});
