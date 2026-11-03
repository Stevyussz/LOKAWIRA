import { APIRequestContext, Browser, Page, expect } from "@playwright/test";
import zlib from "node:zlib";

export const DEMO_PASSWORD = "demo1234";
export const uniq = (p: string) => `${p}-${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;

// halaman baru dgn lokasi palsu tepat di titik pertama (geofence server tes nyala, jadi scan & check-in butuh lokasi)
export async function pageAtFirstSpot(browser: Browser, request: APIRequestContext) {
  const spot = (await (await request.get("/api/spots")).json()).spots[0];
  const ctx = await browser.newContext({
    permissions: ["geolocation"],
    geolocation: { latitude: spot.coordinates.lat, longitude: spot.coordinates.lng, accuracy: 15 },
    viewport: { width: 768, height: 900 },
  });
  return { ctx, page: await ctx.newPage() };
}

export async function apiLogin(request: APIRequestContext, email: string, password = DEMO_PASSWORD) {
  const res = await request.post("/api/auth/login", { data: { email, password } });
  expect(res.ok(), `login ${email}`).toBeTruthy();
  return (await res.json()).token as string;
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

export async function uiLogin(page: Page, email: string, next: string, password = DEMO_PASSWORD) {
  await page.goto(`/masuk?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Kata sandi").fill(password);
  await page.getByRole("button", { name: "Masuk", exact: true }).last().click();
}

function crc32(buf: Buffer) {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

// PNG polos (noise=false) atau berderau (noise=true, ukurannya besar) tanpa dependensi tambahan
export function makePng(w: number, h: number, noise: boolean): Buffer {
  const rows: Buffer[] = [];
  for (let y = 0; y < h; y++) {
    const row = Buffer.alloc(1 + w * 3, noise ? 0 : 200);
    row[0] = 0;
    if (noise) for (let i = 1; i < row.length; i++) row[i] = Math.floor(Math.random() * 256);
    rows.push(row);
  }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
