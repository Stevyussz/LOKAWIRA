import crypto from "node:crypto";
import { INITIAL_LORE_NOTES, LEGACY_NOTE_SUMMARIES } from "../../src/lib/lokaKnowledge";
import { FOCUS_REGION, FOCUS_REGION_ID, INITIAL_CULTURAL_SPOTS, INITIAL_EVENTS, INITIAL_REGIONS, INITIAL_VOUCHERS } from "../../src/lib/seedCulturalData";
import type { CulturalSpot } from "../../src/types/lokawira";
import { pool, tx } from "./db.js";
import { hashPassword } from "./core.js";

// Data contoh (5 kawasan demo, 10 titik, acara, voucer, & rujukan Loka kawasan itu) cuma diisi kalo SEED_SAMPLE_DATA=true
// (QA otomatis / lokal). Produksi fokus ke Jember: yg diisi cuma kawasan Jember + rujukannya, dan data contoh lama dihapus
export const SAMPLE_DATA = process.env.SEED_SAMPLE_DATA === "true";

const SAMPLE_REGION_IDS = INITIAL_REGIONS.filter((r) => r.id !== FOCUS_REGION_ID).map((r) => r.id);
const SAMPLE_SPOT_IDS = [...INITIAL_CULTURAL_SPOTS.map((s) => s.id), "spot-demo-pending"];
const SAMPLE_EVENT_IDS = INITIAL_EVENTS.map((e) => e.id);
const SAMPLE_VOUCHER_IDS = INITIAL_VOUCHERS.map((v) => v.code);
// rujukan bawaan per kawasan: id rag-<kode kawasan>-*. Jember = rag-pdl-*
const isFocusNote = (id: string) => id.startsWith("rag-pdl-");

// Pengetahuan Loka bawaan (bersumber): src/lib/lokaKnowledge.ts
const NOTES = SAMPLE_DATA ? INITIAL_LORE_NOTES : INITIAL_LORE_NOTES.filter((n) => isFocusNote(n.id));
const SAMPLE_NOTE_IDS = INITIAL_LORE_NOTES.filter((n) => !isFocusNote(n.id)).map((n) => n.id);

// hapus data contoh lama dr DB produksi (idempoten; aman diulang). Semua yg nempel ke titik contoh ikut dihapus:
// acara, foto contoh/galeri, voucer, check-in, tiket, metrik, jejak hadiah
async function purgeSampleData() {
  await tx(async (c) => {
    const spots = await c.query("DELETE FROM entities WHERE kind='spot' AND id = ANY($1::text[])", [SAMPLE_SPOT_IDS]);
    const linked = await c.query(
      "DELETE FROM entities WHERE kind IN ('event','reference-image','gallery-image','voucher','checkin','reservation','loka-gap') AND payload->>'spotId' = ANY($1::text[])",
      [SAMPLE_SPOT_IDS]
    );
    await c.query("DELETE FROM entities WHERE (kind='event' AND id = ANY($1::text[])) OR (kind='voucher' AND id = ANY($2::text[]))", [SAMPLE_EVENT_IDS, SAMPLE_VOUCHER_IDS]);
    // rujukan bawaan kawasan contoh: dihapus cuma kalo isinya belum pernah diubah pengelola
    for (const n of INITIAL_LORE_NOTES.filter((x) => SAMPLE_NOTE_IDS.includes(x.id))) {
      await c.query("DELETE FROM entities WHERE kind='ai-note' AND id=$1 AND payload->>'summary'=$2", [n.id, n.summary]);
    }
    const regions = await c.query("DELETE FROM entities WHERE kind='region' AND id = ANY($1::text[])", [SAMPLE_REGION_IDS]);
    await c.query("DELETE FROM metrics WHERE spot_id = ANY($1::text[])", [SAMPLE_SPOT_IDS]);
    await c.query("DELETE FROM reward_log WHERE spot_id = ANY($1::text[])", [SAMPLE_SPOT_IDS]);
    // kawasan Jember masih label/status bawaan "rencana survei" -> diaktifkan sbg kawasan utama.
    // Kalo pengelola udah ngubah label/statusnya sendiri, gak disentuh
    await c.query(
      "UPDATE entities SET payload = payload || $2::jsonb WHERE kind='region' AND id=$1 AND payload->>'label' = 'Jember (rencana survei)' AND payload->>'status' = 'DRAFT'",
      [FOCUS_REGION_ID, JSON.stringify({ label: FOCUS_REGION.label, status: FOCUS_REGION.status })]
    );
    if ((spots.rowCount ?? 0) + (regions.rowCount ?? 0) + (linked.rowCount ?? 0) > 0) {
      console.info(`Data contoh dihapus: ${regions.rowCount} kawasan, ${spots.rowCount} titik, ${linked.rowCount} data terkait.`);
    }
  });
}

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
  if (!SAMPLE_DATA) await purgeSampleData();
  await tx(async (c) => {
    const now = new Date().toISOString();
    // waktu buat data awal sengaja dibikin berurutan & lebih tua dr data baru: urutan peta tetap sama tiap start
    // (dulu semua sama persis jadi urutannya acak). Titik: yg pertama di seed = paling baru di antara data awal
    const BASE = Date.parse("2026-01-01T00:00:00Z");
    const at = (ms: number) => new Date(ms).toISOString();
    const regions = SAMPLE_DATA ? INITIAL_REGIONS : [FOCUS_REGION];
    for (const [i, r] of regions.entries()) {
      await c.query("INSERT INTO entities(id,kind,created_at,payload) VALUES($1,'region',$2,$3) ON CONFLICT DO NOTHING", [r.id, at(BASE + i * 1000), JSON.stringify({ ...r, createdAt: r.createdAt ?? at(BASE + i * 1000) })]);
    }
    for (const [i, s] of (SAMPLE_DATA ? INITIAL_CULTURAL_SPOTS : []).entries()) {
      await c.query("INSERT INTO entities(id,kind,created_at,payload) VALUES($1,'spot',$2,$3) ON CONFLICT DO NOTHING", [s.id, at(BASE - i * 1000), JSON.stringify({ ...s, status: s.status ?? "PUBLISHED" })]);
    }
    for (const [i, e] of (SAMPLE_DATA ? INITIAL_EVENTS : []).entries()) {
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
    await upsertUser("u-mitra-1", SAMPLE_DATA ? "Mitra Demo Trowulan" : "Mitra Uji", "mitra@lokawira.demo", "MERCHANT", pw, "ACTIVE");
    await upsertUser("u-mitra-2", "Calon Mitra Uji", "calon@lokawira.demo", "MERCHANT", pw, "PENDING");
    await upsertUser("u-admin-1", "Pengelola Demo", "admin@lokawira.demo", "ADMIN", pw, null);
    // lapak & voucer contoh cuma ada kalo data contoh diisi
    // nama lama akun mitra uji nyebut Trowulan; diganti kalo belum diubah
    if (!SAMPLE_DATA) await pool.query("UPDATE users SET name='Mitra Uji' WHERE id='u-mitra-1' AND name='Mitra Demo Trowulan'");
    if (SAMPLE_DATA) await tx(async (c) => {
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
