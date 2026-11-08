import crypto from "node:crypto";
import { INITIAL_LORE_NOTES, LEGACY_NOTE_SUMMARIES } from "../../src/lib/lokaKnowledge";
import { INITIAL_CULTURAL_SPOTS, INITIAL_EVENTS, INITIAL_REGIONS, INITIAL_VOUCHERS } from "../../src/lib/seedCulturalData";
import type { CulturalSpot } from "../../src/types/lokawira";
import { pool, tx } from "./db.js";
import { hashPassword } from "./core.js";

// Pengetahuan Loka bawaan (bersumber): src/lib/lokaKnowledge.ts
const NOTES = INITIAL_LORE_NOTES;

async function upsertUser(id: string, name: string, email: string, role: string, password: string, status: string | null) {
  const salt = crypto.randomBytes(16).toString("hex");
  await pool.query(
    "INSERT INTO users(id,email,name,role,status,password_salt,password_hash,email_verified) VALUES($1,$2,$3,$4,$5,$6,$7,true) ON CONFLICT DO NOTHING",
    [id, email.toLowerCase(), name, role, status, salt, await hashPassword(password, salt)]
  );
  await pool.query("INSERT INTO profiles(user_id) SELECT id FROM users WHERE email=$1 ON CONFLICT DO NOTHING", [email.toLowerCase()]);
}

// isi awal idempoten: ON CONFLICT DO NOTHING, data yg udah diubah pengelola gak ketimpa saat restart
export async function seed() {
  await tx(async (c) => {
    const now = new Date().toISOString();
    // waktu buat data awal sengaja dibikin berurutan & lebih tua dr data baru: urutan peta tetap sama tiap start
    // (dulu semua sama persis jadi urutannya acak). Titik: yg pertama di seed = paling baru di antara data awal
    const BASE = Date.parse("2026-01-01T00:00:00Z");
    const at = (ms: number) => new Date(ms).toISOString();
    for (const [i, r] of INITIAL_REGIONS.entries()) {
      await c.query("INSERT INTO entities(id,kind,created_at,payload) VALUES($1,'region',$2,$3) ON CONFLICT DO NOTHING", [r.id, at(BASE + i * 1000), JSON.stringify({ ...r, createdAt: r.createdAt ?? at(BASE + i * 1000) })]);
    }
    for (const [i, s] of INITIAL_CULTURAL_SPOTS.entries()) {
      await c.query("INSERT INTO entities(id,kind,created_at,payload) VALUES($1,'spot',$2,$3) ON CONFLICT DO NOTHING", [s.id, at(BASE - i * 1000), JSON.stringify({ ...s, status: s.status ?? "PUBLISHED" })]);
    }
    for (const [i, e] of INITIAL_EVENTS.entries()) {
      await c.query("INSERT INTO entities(id,kind,created_at,payload) VALUES($1,'event',$2,$3) ON CONFLICT DO NOTHING", [e.id, at(BASE + i * 1000), JSON.stringify({ ...e, createdAt: now })]);
    }
    // catatan bawaan lama yg sumbernya belum bisa dicek: dihapus kalo isinya belum diubah pengelola
    for (const [id, summary] of Object.entries(LEGACY_NOTE_SUMMARIES)) {
      await c.query("DELETE FROM entities WHERE kind='ai-note' AND id=$1 AND payload->>'summary'=$2", [id, summary]);
    }
    for (const [i, n] of NOTES.entries()) {
      await c.query("INSERT INTO entities(id,kind,created_at,payload) VALUES($1,'ai-note',$2,$3) ON CONFLICT DO NOTHING", [n.id, at(BASE - i * 1000), JSON.stringify({ ...n, updatedAt: now })]);
    }
  });

  // pengelola pertama dr env (gak pernah reset sandi akun yg udah ada)
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    if (process.env.ADMIN_PASSWORD.length < 10) throw new Error("ADMIN_PASSWORD minimal 10 karakter.");
    await upsertUser("admin-bootstrap", process.env.ADMIN_NAME ?? "Pengelola LOKAWIRA", process.env.ADMIN_EMAIL.trim(), "ADMIN", process.env.ADMIN_PASSWORD, null);
  }

  // akun uji utk Tim Kurasi (Lampiran G). Nyala cuma kalo DEMO_ACCOUNTS=true
  if (process.env.DEMO_ACCOUNTS === "true") {
    const pw = process.env.DEMO_PASSWORD || "demo1234";
    await upsertUser("u-wisatawan-1", "Wisatawan Demo", "wisatawan@lokawira.demo", "VISITOR", pw, null);
    await upsertUser("u-mitra-1", "Mitra Demo Trowulan", "mitra@lokawira.demo", "MERCHANT", pw, "ACTIVE");
    await upsertUser("u-mitra-2", "Kedai Kopi Calon Mitra", "calon@lokawira.demo", "MERCHANT", pw, "PENDING");
    await upsertUser("u-admin-1", "Pengelola Demo", "admin@lokawira.demo", "ADMIN", pw, null);
    await tx(async (c) => {
      // lapak contoh milik mitra demo (cuma kalo belum ada pemiliknya)
      for (const id of ["spot-mjp-02", "spot-mjp-03"]) {
        await c.query("UPDATE entities SET owner_id='u-mitra-1', payload=payload||'{\"ownerId\":\"u-mitra-1\"}'::jsonb WHERE kind='spot' AND id=$1 AND owner_id IS NULL", [id]);
      }
      const base = INITIAL_CULTURAL_SPOTS.find((s) => s.id === "spot-mjp-02");
      if (base) {
        const pending: CulturalSpot = {
          ...structuredClone(base),
          id: "spot-demo-pending",
          ownerId: "u-mitra-2",
          status: "PENDING_REVIEW",
          createdAt: new Date().toISOString(),
          name: "Kedai Kopi Pawon Trowulan",
          spotType: "UMKM_KULINER",
          opkCategory: "Pengetahuan Tradisional",
          address: "Jl. Raya Trowulan, sebelah balai desa",
          coordinates: { lat: base.coordinates.lat + 0.0012, lng: base.coordinates.lng + 0.0009 },
        };
        // lapak menunggu review diselipin paling atas (kayak lapak baru)
        await c.query("INSERT INTO entities(id,kind,owner_id,payload) VALUES($1,'spot','u-mitra-2',$2) ON CONFLICT DO NOTHING", [pending.id, JSON.stringify(pending)]);
      }
      // voucer contoh di tas wisatawan demo (buat dicoba di Kasir), termasuk 1 yg udah kedaluwarsa
      for (const v of INITIAL_VOUCHERS) {
        await c.query("INSERT INTO entities(id,kind,owner_id,payload) VALUES($1,'voucher','u-wisatawan-1',$2) ON CONFLICT DO NOTHING", [v.code, JSON.stringify({ ...v, issuedAt: v.issuedAt ?? new Date().toISOString() })]);
      }
    });
  }
}
