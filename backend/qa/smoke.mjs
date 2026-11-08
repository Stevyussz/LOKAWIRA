// QA backend: alur penuh, celah eksploit lama, endpoint kawasan/acara/dampak.
// Jalankan ke backend yg nyala dgn DEMO_ACCOUNTS=true & GEOFENCE_ENABLED=true:  B=http://localhost:4000 npm run qa
// Daftar akun dibatasi 10/jam per IP, jadi maks ~1x jalan per jam dr IP yg sama (atau lewat proxy uji)
const B = process.env.B || "http://127.0.0.1:4000";
const R = [];
const ok = (name, cond, info = "") => R.push({ name, pass: !!cond, info });
async function call(method, path, { token, body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { headers["Content-Type"] = "application/json"; payload = JSON.stringify(body); }
  const t0 = performance.now();
  const r = await fetch(B + path, { method, headers, body: payload });
  const ms = Math.round(performance.now() - t0);
  const txt = await r.text(); let j; try { j = JSON.parse(txt); } catch { j = txt; }
  return { s: r.status, j, ms };
}
const rnd = Math.random().toString(36).slice(2, 8);
// lokasi lapak yatim acak di Kalimantan tiap jalan, biar skrip bisa diulang di DB yg sama
const far = { lat: -1 - Math.random() * 2, lng: 110.5 + Math.random() * 5 };
const reg = async (name, role) => (await call("POST", "/api/auth/register", { body: { name, email: `${name.replace(/\W/g, "").toLowerCase()}${rnd}${Math.random().toString(36).slice(2, 5)}@t.id`, password: "password1", role } })).j;

const A = (await call("POST", "/api/auth/login", { body: { email: "admin@lokawira.demo", password: "demo1234" } })).j.token;
const MD = (await call("POST", "/api/auth/login", { body: { email: "mitra@lokawira.demo", password: "demo1234" } })).j.token;
ok("akun uji demo bisa masuk", A && MD);
const V = (await reg("Wisata", "VISITOR")).token;
const m = await reg("Mitra Satu", "MERCHANT"); const M = m.token;
const m2 = await reg("Mitra Dua", "MERCHANT"); const M2 = m2.token;
await call("POST", `/api/admin/merchants/${m.user.id}/approve`, { token: A });
await call("POST", `/api/admin/merchants/${m2.user.id}/approve`, { token: A });

const pub = await call("GET", "/api/spots");
const prim = pub.j.spots.find((s) => s.id === "spot-mjp-01");
ok("GET /api/spots + regions", pub.s === 200 && pub.j.regions?.length >= 5, `${pub.j.spots.length} titik, ${pub.ms}ms`);
ok("kawasan DRAFT (Jember) tidak tampil publik", !pub.j.regions.some((r) => r.id === "rgn-pandhalungan"));
const adminSnap = await call("GET", "/api/spots", { token: A });
ok("pengelola lihat kawasan draf + titik pending", adminSnap.j.regions.some((r) => r.id === "rgn-pandhalungan") && adminSnap.j.spots.some((s) => s.status === "PENDING_REVIEW"));

// ---- celah 1: POST /api/spots dulu terima body mentah
const base = structuredClone(pub.j.spots.find((s) => s.id === "spot-mjp-02"));
const evil = { ...base, name: `Lapak Uji ${rnd}`, spotType: "UMKM_KULINER", coordinates: { lat: prim.coordinates.lat + 0.0006, lng: prim.coordinates.lng }, status: "PUBLISHED", ownerId: "u-admin-1", regionId: "rgn-sogan", vibe: "tridatu" };
evil.quest = { ...evil.quest, rewardPoints: 1000000, verifiedLoreSource: "BPCB resmi palsu" };
evil.quota = { ...evil.quota, maxCapacity: 400, currentVisitors: 999 };
const c1 = await call("POST", "/api/spots", { token: M, body: evil });
const sp = c1.j.spot;
ok("[celah] POST spot mitra: 201 PENDING_REVIEW", c1.s === 201 && sp.status === "PENDING_REVIEW", c1.s);
ok("[celah] rewardPoints mitra dipaksa 100", sp.quest.rewardPoints === 100, sp.quest.rewardPoints);
ok("[celah] sumber terverifikasi tidak bisa dikarang mitra", sp.quest.verifiedLoreSource.includes("belum diverifikasi"));
ok("[celah] owner/kawasan/palet ditentukan server", sp.ownerId === m.user.id && sp.regionId === "rgn-majapahit" && sp.vibe === "majapahit");
ok("[celah] pengunjung mulai 0", sp.quota.currentVisitors === 0);
ok("[celah] kapasitas mitra >500 ditolak", (await call("POST", "/api/spots", { token: M, body: { ...evil, quota: { maxCapacity: 999999 } } })).s === 400);
ok("pin di luar Indonesia ditolak", (await call("POST", "/api/spots", { token: M, body: { ...evil, coordinates: { lat: 48.85, lng: 2.35 } } })).j.code === "OUT_OF_INDONESIA");
const orphan = await call("POST", "/api/spots", { token: M, body: { ...evil, name: `Yatim ${rnd}`, coordinates: far, regionProposal: "Banjarmasin" } });
ok("lapak di luar kawasan diterima sbg usulan", orphan.s === 201 && !orphan.j.spot.regionId && orphan.j.spot.regionProposal === "Banjarmasin");
ok("publish lapak tanpa kawasan ditolak (NO_REGION)", (await call("POST", `/api/admin/spots/${orphan.j.spot.id}/review`, { token: A, body: { decision: "PUBLISH" } })).j.code === "NO_REGION");
const pubBefore = await call("GET", "/api/spots");
ok("lapak pending tidak tampil publik", !pubBefore.j.spots.some((s) => s.id === sp.id));
ok("admin publish", (await call("POST", `/api/admin/spots/${sp.id}/review`, { token: A, body: { decision: "PUBLISH" } })).s === 200);
const p1 = await call("PATCH", `/api/spots/${sp.id}`, { token: M, body: { spotType: "PRIMARY_DEST", quest: { rewardPoints: 1000, verifiedLoreSource: "x" }, status: "PUBLISHED" } });
ok("PATCH mitra: field admin diabaikan", p1.s === 200 && p1.j.spot.spotType === "UMKM_KULINER" && p1.j.spot.quest.rewardPoints === 100);
ok("PATCH mitra lain 403", (await call("PATCH", `/api/spots/${sp.id}`, { token: M2, body: { name: "Bajak" } })).s === 403);
const p2 = await call("PATCH", `/api/spots/${sp.id}`, { token: M, body: { name: "x", address: "Jalan baru panjang" } });
ok("PATCH atomik: satu field gagal = tidak ada yg tersimpan", p2.s === 400 && (await call("GET", "/api/spots", { token: M })).j.spots.find((s) => s.id === sp.id).address === base.address);
const p3 = await call("PATCH", `/api/spots/${sp.id}`, { token: M, body: { entry: { mode: "FREE" }, openingHours: { days: [0,1,2,3,4,5,6], open: "00:00", close: "23:59" }, highlight: "Boleh lihat proses membuat cobek" } });
ok("PATCH cara masuk + jam buka + highlight", p3.s === 200 && p3.j.spot.entry.mode === "FREE", p3.j.error ?? "");

// ---- check-in + KDR
const ci = await call("POST", "/api/checkins", { token: V, body: { spotId: sp.id, lat: sp.coordinates.lat, lng: sp.coordinates.lng, accuracyMeters: 10 } });
ok("check-in di titik (geofence)", ci.s === 200 && /^KDR-\d{6}$/.test(ci.j.checkIn?.code), `${ci.s} ${ci.j.error ?? ""} ${ci.ms}ms`);
ok("check-in jauh ditolak OUT_OF_RANGE", (await call("POST", "/api/checkins", { token: V, body: { spotId: prim.id, lat: prim.coordinates.lat + 0.01, lng: prim.coordinates.lng, accuracyMeters: 10 } })).j.code === "OUT_OF_RANGE");
ok("check-in kedua hari sama 409", (await call("POST", "/api/checkins", { token: V, body: { spotId: sp.id, lat: sp.coordinates.lat, lng: sp.coordinates.lng, accuracyMeters: 10 } })).s === 409);
ok("KDR lapak lain 403", (await call("POST", "/api/checkins/verify", { token: M2, body: { code: ci.j.checkIn.code } })).s === 403);
const kdr = await call("POST", "/api/checkins/verify", { token: M, body: { code: ci.j.checkIn.code.toLowerCase() } });
ok("KDR pemilik: XP misi = 100 (bukan 1 juta)", kdr.s === 200 && kdr.j.awardedPoints === 100 && kdr.j.visitorHasAccount === true, JSON.stringify(kdr.j).slice(0, 80));
ok("KDR sekali pakai", (await call("POST", "/api/checkins/verify", { token: M, body: { code: ci.j.checkIn.code } })).s === 409);

// ---- tamu dibedakan per perangkat (bkn per IP)
const devA = `devA${rnd}${"x".repeat(16)}`, devB = `devB${rnd}${"y".repeat(16)}`;
const gw = { spotId: prim.id, lat: prim.coordinates.lat, lng: prim.coordinates.lng, accuracyMeters: 10 };
const gA = await call("POST", "/api/checkins", { body: { ...gw, deviceId: devA } });
const gB = await call("POST", "/api/checkins", { body: { ...gw, deviceId: devB } });
const gA2 = await call("POST", "/api/checkins", { body: { ...gw, deviceId: devA } });
ok("2 tamu beda HP di 1 WiFi bisa check-in; HP yg sama tetap 1x/hari", gA.s === 200 && gB.s === 200 && gA2.s === 409, `${gA.s},${gB.s},${gA2.s}`);

// ---- pengalihan antrean cuma saat padat (>= 85%) & ke lapak lain
const primQ = prim.quota;
await call("PATCH", `/api/spots/${prim.id}/quota`, { token: A, body: { currentVisitors: 0 } });
const V2 = (await reg("Wisata Dua", "VISITOR")).token;
const calm = await call("POST", "/api/reservations", { token: V2, body: { spotId: prim.id, visitorName: "Wis", partySize: 1, acceptCircularQuest: true } });
ok("tidak padat: tidak ada voucer pengalih (NOT_CROWDED)", calm.s === 200 && !calm.j.bonusVoucher && calm.j.rewardNote === "NOT_CROWDED", calm.j.rewardNote);
await call("PATCH", `/api/spots/${prim.id}/quota`, { token: A, body: { currentVisitors: primQ.maxCapacity } });

// ---- celah 2: reservasi XP tanpa batas & di titik bebas masuk
const xp0 = (await call("GET", "/api/me/profile", { token: V })).j.xp;
const rs = [];
for (let i = 0; i < 3; i++) rs.push(await call("POST", "/api/reservations", { token: V, body: { spotId: prim.id, visitorName: "Wis", partySize: 2, acceptCircularQuest: true } }));
const xp1 = (await call("GET", "/api/me/profile", { token: V })).j.xp;
ok("[celah] 3 reservasi = XP +75 sekali saja", xp1 - xp0 === 75, `+${xp1 - xp0}`);
ok("[celah] voucer pengalih sekali per lapak per hari", rs.filter((r) => r.j.bonusVoucher).length === 1 && rs[1].j.rewardNote === "ALREADY_CLAIMED_TODAY", rs.map((r) => r.j.rewardNote ?? (r.j.bonusVoucher ? "VOUCER" : "-")).join(","));
const bv = rs[0].j.bonusVoucher;
ok("voucer pengalih dari lapak lain, bukan tempat yg padat", bv && bv.spotId !== prim.id, bv?.spotId);
ok("[celah] voucer pengalih punya masa berlaku (akhir hari WIB)", bv && bv.expiresAt && new Date(bv.expiresAt) > new Date() && new Date(bv.expiresAt) - Date.now() < 86400000, bv?.expiresAt);
ok("[celah] reservasi di titik bebas masuk ditolak", (await call("POST", "/api/reservations", { token: V, body: { spotId: sp.id, visitorName: "Wis", partySize: 1 } })).j.code === "NO_BOOKING_NEEDED");
// ---- celah 3: tamu panen voucer pengalih
let g = 0, gn = "";
for (let i = 0; i < 4; i++) { const x = await call("POST", "/api/reservations", { body: { spotId: prim.id, visitorName: "Tamu", partySize: 1, acceptCircularQuest: true } }); if (x.j.bonusVoucher) g++; gn = x.j.rewardNote; }
ok("[celah] tamu tidak dapat voucer pengalih", g === 0 && gn === "LOGIN_FOR_REWARD", `${g} voucer, note=${gn}`);
await call("PATCH", `/api/spots/${prim.id}/quota`, { token: A, body: { currentVisitors: primQ.currentVisitors } });

// ---- kapasitas per slot: total orang di 1 slot gak boleh lewat kapasitas
await call("PATCH", `/api/spots/${prim.id}`, { token: A, body: { quota: { maxCapacity: 5 } } });
const slotName = `QA-${rnd}`;
const s1 = await call("POST", "/api/reservations", { token: V, body: { spotId: prim.id, visitorName: "Wis", partySize: 3, scheduledSlot: slotName } });
const s2 = await call("POST", "/api/reservations", { token: V, body: { spotId: prim.id, visitorName: "Wis", partySize: 3, scheduledSlot: slotName } });
const s3 = await call("POST", "/api/reservations", { token: V, body: { spotId: prim.id, visitorName: "Wis", partySize: 2, scheduledSlot: slotName } });
ok("slot penuh ditolak SLOT_FULL + sisa kursi", s1.s === 200 && s2.s === 409 && s2.j.code === "SLOT_FULL" && s2.j.details?.remaining === 2 && s3.s === 200, `${s1.s},${s2.s} sisa=${s2.j.details?.remaining},${s3.s}`);
const race = await Promise.all(Array.from({ length: 5 }, () => call("POST", "/api/reservations", { token: V, body: { spotId: prim.id, visitorName: "Wis", partySize: 2, scheduledSlot: `${slotName}-r` } })));
ok("5 pesan serentak (2 org) di kapasitas 5: tepat 2 sukses", race.filter((r) => r.s === 200).length === 2, race.map((r) => r.s).join(","));
await call("PATCH", `/api/spots/${prim.id}`, { token: A, body: { quota: { maxCapacity: primQ.maxCapacity } } });
await call("PATCH", `/api/spots/${prim.id}/quota`, { token: A, body: { currentVisitors: primQ.currentVisitors } });

// ---- kasir
if (bv) {
  const owner = (await call("GET", "/api/spots", { token: A })).j.spots.find((s) => s.id === bv.spotId);
  const tok = owner?.ownerId === m.user.id ? M : owner?.ownerId === "u-mitra-1" ? MD : A;
  if (tok !== M2) ok("tebus di lapak lain 403", (await call("POST", "/api/vouchers/redeem", { token: M2, body: { code: bv.code } })).s === 403);
  const races = await Promise.all(Array.from({ length: 6 }, () => call("POST", "/api/vouchers/redeem", { token: tok, body: { code: bv.code.replace("LKW-", "") } })));
  ok("6 tebus serentak: tepat 1 sukses", races.filter((r) => r.s === 200).length === 1 && races.filter((r) => r.s === 409).length === 5, races.map((r) => r.s).join(","));
  const okR = races.find((r) => r.s === 200);
  const ownIds = new Set((await call("GET", "/api/spots", { token: A })).j.spots.filter((s) => s.ownerId && s.ownerId === owner?.ownerId).map((s) => s.id));
  ok("respons kasir cuma voucer lapak sendiri", okR && okR.j.vouchers.length > 0 && (tok === A || okR.j.vouchers.every((v) => ownIds.has(v.spotId))), `${okR?.j.vouchers.length} voucer`);
}
const exp = await call("POST", "/api/vouchers/redeem", { token: MD, body: { code: "LKW-100001" } });
ok("voucer kedaluwarsa ditolak 410", exp.s === 410 && exp.j.code === "VOUCHER_EXPIRED", exp.s);
const seedV = await call("POST", "/api/vouchers/redeem", { token: MD, body: { code: "849201" } });
ok("voucer contoh demo bisa ditebus mitra demo (atau sudah ditebus run sebelumnya)", seedV.s === 200 || seedV.j.code === "VOUCHER_ALREADY_REDEEMED", `${seedV.s} ${seedV.ms}ms`);

// ---- info tempat + galeri (sheet Info)
const { deflateSync } = await import("node:zlib");
const crc = (buf) => { let c = ~0; for (const b of buf) { c ^= b; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
const mkPng = (w, h) => { const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2; const raw = Buffer.alloc((w * 3 + 1) * h, 180); for (let y = 0; y < h; y++) raw[y * (w * 3 + 1)] = 0; return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ih), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]); };
const galForm = (caption) => { const f = new FormData(); if (caption) f.append("caption", caption); f.append("image", new Blob([mkPng(40, 30)], { type: "image/png" }), "a.png"); return f; };
ok("info: 9 peraturan ditolak", (await call("PATCH", `/api/spots/${sp.id}`, { token: M, body: { rules: Array.from({ length: 9 }, (_, i) => `aturan ${i}`) } })).s === 400);
const inf = await call("PATCH", `/api/spots/${sp.id}`, { token: M, body: { description: "Lapak cobek batu.", rules: [" Antre ", ""], contact: "WA 0812" } });
ok("info: deskripsi/peraturan/kontak tersimpan & dirapikan", inf.s === 200 && inf.j.spot.description === "Lapak cobek batu." && inf.j.spot.rules.length === 1 && inf.j.spot.rules[0] === "Antre", inf.j.error ?? "");
ok("galeri: lapak orang lain 403", (await call("POST", `/api/spots/${prim.id}/gallery`, { token: M, form: galForm() })).s === 403);
const gal = []; for (let i = 0; i < 6; i++) gal.push(await call("POST", `/api/spots/${sp.id}/gallery`, { token: M, form: galForm(`Sudut ${i}`) }));
const gal7 = await call("POST", `/api/spots/${sp.id}/gallery`, { token: M, form: galForm() });
ok("galeri: 6 foto masuk, ke-7 ditolak 409", gal.every((x) => x.s === 200) && gal7.s === 409 && gal[5].j.gallery.length === 6 && gal[0].j.gallery[0].caption === "Sudut 0", gal.map((x) => x.s).join(","));
const gurl = gal[5].j.gallery[0].url;
const gimg = await fetch(B + gurl);
ok("galeri: foto bisa dibuka publik (image/png)", gimg.status === 200 && gimg.headers.get("content-type") === "image/png");
const gdel = await call("DELETE", `/api/spots/${sp.id}/gallery/${gal[5].j.gallery[1].id}`, { token: M });
ok("galeri: hapus foto", gdel.s === 200 && gdel.j.gallery.length === 5);
const story = await call("PATCH", `/api/spots/${sp.id}`, { token: M, body: { quest: { loreNarrative: "Cerita diganti mitra setelah terbit." } } });
ok("mitra ganti cerita = ditinjau ulang (PENDING_REVIEW)", story.s === 200 && story.j.spot.status === "PENDING_REVIEW", story.j.spot?.status);
await call("POST", `/api/admin/spots/${sp.id}/review`, { token: A, body: { decision: "REJECT", reason: "uji" } });
ok("foto galeri lapak ditolak tidak bisa dibuka", (await fetch(B + gurl)).status === 404);
// terbitkan lagi: lapak ini masih dipakai tes agenda & dampak di bawah
await call("POST", `/api/admin/spots/${sp.id}/review`, { token: A, body: { decision: "PUBLISH" } });

// ---- kawasan
const rg = await call("POST", "/api/regions", { token: A, body: { name: `Banjar ${rnd}`, label: "Banjarmasin, Kalsel", theme: "bahari", center: far, radiusKm: 1, status: "DRAFT" } });
ok("kawasan baru + adopsi lapak yatim", rg.s === 201 && rg.j.adopted >= 1, `adopted=${rg.j.adopted}`);
ok("nama kawasan kembar 409", (await call("POST", "/api/regions", { token: A, body: { name: `banjar ${rnd}`, label: "x x x", theme: "bahari", center: { lat: -3.3, lng: 114.6 }, radiusKm: 10 } })).s === 409);
ok("mitra tidak bisa buat kawasan", (await call("POST", "/api/regions", { token: M, body: {} })).s === 403);
const rp = await call("PATCH", `/api/regions/${rg.j.region.id}`, { token: A, body: { theme: "tridatu", status: "ACTIVE" } });
const adopted = (await call("GET", "/api/spots", { token: A })).j.spots.find((s) => s.id === orphan.j.spot.id);
ok("ubah palet kawasan ikut ke titiknya", rp.s === 200 && adopted.vibe === "tridatu" && adopted.regionId === rg.j.region.id);
ok("pusat kawasan di luar Indonesia ditolak", (await call("POST", "/api/regions", { token: A, body: { name: "Paris x", label: "Paris, FR", theme: "bahari", center: { lat: 48.8, lng: 2.3 }, radiusKm: 10 } })).s === 400);

// ---- acara
const startsAt = new Date(Date.now() + 3 * 86400000).toISOString();
const ev = await call("POST", "/api/events", { token: M, body: { spotId: sp.id, title: "Latihan terbuka", startsAt, endsAt: new Date(Date.parse(startsAt) + 7200000).toISOString(), repeat: "WEEKLY" } });
ok("mitra tambah acara rutin", ev.s === 201, ev.j.error ?? "");
ok("acara di lapak orang lain 403", (await call("POST", "/api/events", { token: M2, body: { spotId: sp.id, title: "Iseng", startsAt, endsAt: new Date(Date.parse(startsAt) + 3600000).toISOString() } })).s === 403);
ok("acara >12 jam ditolak", (await call("POST", "/api/events", { token: M, body: { spotId: sp.id, title: "Panjang", startsAt, endsAt: new Date(Date.parse(startsAt) + 13 * 3600000).toISOString() } })).s === 400);
const agenda = await call("GET", `/api/events?days=30&regionId=rgn-majapahit`);
ok("agenda publik memuat acara baru (berulang mingguan)", agenda.j.occurrences.filter((o) => o.spotId === sp.id).length >= 4, `${agenda.j.occurrences.length} kemunculan`);
ok("tamu tidak dapat daftar kelola acara", agenda.j.events === undefined);
ok("hapus acara oleh pemilik", (await call("DELETE", `/api/events/${ev.j.event.id}`, { token: M })).s === 200);

// ---- dampak
for (const t of ["QR_OPEN", "GUIDE_START", "REMINDER_SAVED"]) await call("POST", "/api/metrics", { body: { type: t, spotId: sp.id } });
ok("jenis metrik palsu ditolak", (await call("POST", "/api/metrics", { body: { type: "HACK", spotId: sp.id } })).s === 400);
const imp = await call("GET", "/api/metrics?days=30", { token: M });
ok("dampak mitra: cuma lapaknya, angka tercatat", imp.s === 200 && imp.j.spots.every((s) => s.spotId === sp.id || s.spotId === orphan.j.spot.id) && imp.j.totals.qrOpens >= 1 && imp.j.totals.checkInsVerified >= 1, JSON.stringify(imp.j.totals));
const impA = await call("GET", "/api/metrics?days=30", { token: A });
ok("dampak pengelola: semua titik + nilai voucer ditukar", impA.s === 200 && impA.j.totals.redeemedValue >= 15000, `redeemed=Rp${impA.j.totals.redeemedValue}`);
ok("tamu tidak bisa lihat dampak", (await call("GET", "/api/metrics")).s === 401);

// ---- AI tanpa kunci / validasi
const st = await call("POST", "/api/ai/storyteller", { body: { spotId: prim.id, customQuestion: "kosod bata merah?" } });
ok("storyteller jalan + rujukan", st.s === 200 && st.j.story && st.j.references?.length >= 1, `${st.j.sourceMode} ${st.ms}ms refs=${st.j.references?.length}`);

// ---- Loka: tanya-jawab, catatan pertanyaan, bantu mitra, alat pengelola (jalan dgn/tanpa kunci AI)
const lp = await call("POST", "/api/ai/storyteller", { body: { spotId: prim.id, customQuestion: "Ada acara apa minggu ini?", history: [{ q: "halo", a: "hai" }] } });
ok("Loka jawab hal praktis dr data lapak", lp.s === 200 && lp.j.answer && lp.j.references?.includes("Data lapak di LOKAWIRA (diisi pemilik)") && Array.isArray(lp.j.followUps), `${lp.j.sourceMode} ${lp.ms}ms`);
ok("petunjuk misi tetap kurasi (bukan buatan AI)", lp.j.riddle === prim.quest.riddleClue);
ok("tanpa pertanyaan = narasi kurasi", (await call("POST", "/api/ai/storyteller", { body: { spotId: prim.id } })).j.sourceMode === "CURATED");
const gq = await call("POST", "/api/ai/storyteller", { token: V, body: { spotId: prim.id, customQuestion: `Siapa arsitek kuncup zirkonia ${rnd} itu? 0812 3456 7890` } });
ok("pertanyaan tanpa rujukan dijawab jujur", gq.j.answered === false, `${gq.j.sourceMode} ${gq.ms}ms`);
const gaps = await call("GET", "/api/ai/gaps", { token: A });
const gg = gaps.j.gaps?.find((g) => g.spotId === prim.id);
const gs = gg?.samples.find((x) => x.includes(rnd));
ok("pertanyaan belum terjawab tercatat, nomor disamarkan", gs && gs.includes("[disamarkan]") && !gs.includes("0812"), gs);
ok("catatan pertanyaan cuma buat pengelola", (await call("GET", "/api/ai/gaps", { token: MD })).s === 403 && (await call("GET", "/api/ai/gaps")).s === 401);
ok("tandai pertanyaan beres", !(await call("DELETE", `/api/ai/gaps/${prim.id}`, { token: A })).j.gaps.some((g) => g.spotId === prim.id));
const pol = await call("POST", "/api/ai/assist", { token: MD, body: { task: "polish-info", spotId: "spot-mjp-03", notes: "jual wedang pokak hangat dan sambel wader buatan keluarga\n- antre di depan kasir" } });
ok("Loka rapikan info tempat mitra", pol.s === 200 && pol.j.description?.length > 10 && Array.isArray(pol.j.rules), `${pol.j.mode} ${pol.ms}ms`);
ok("bantu tulis cuma lapak sendiri / peran mitra", (await call("POST", "/api/ai/assist", { token: MD, body: { task: "polish-info", spotId: sp.id, notes: "bukan lapak saya ini ya panjang" } })).s === 403 && (await call("POST", "/api/ai/assist", { token: V, body: { task: "polish-info", notes: "wisatawan tidak boleh pakai ini" } })).s === 403);
const clu = await call("POST", "/api/ai/assist", { token: MD, body: { task: "suggest-clue", spotId: "spot-mjp-03" } });
ok("saran petunjuk misi", clu.s === 200 && clu.j.clues?.length >= 1, `${clu.j.mode} ${clu.ms}ms`);
const rv = await call("POST", "/api/ai/review/spot-mjp-02", { token: A });
ok("periksa pengajuan (pengelola)", rv.s === 200 && Array.isArray(rv.j.checks) && (await call("POST", "/api/ai/review/spot-mjp-02", { token: MD })).s === 403, `${rv.j.mode} ${rv.ms}ms ${rv.j.checks?.length} temuan`);
const ex = await call("POST", "/api/ai/extract-notes", { token: A, body: { opkCategory: "Adat Istiadat", text: "Kotagede berdiri sebagai ibu kota Mataram Islam pada abad ke-16. Kompleks makam dan Sendang Seliran dijaga abdi dalem. Pengunjung wajib memakai kain jarik saat memasuki kompleks makam." } });
ok("pecah teks sumber jadi draf rujukan", ex.s === 200 && ex.j.drafts?.length >= 1, `${ex.j.mode} ${ex.ms}ms ${ex.j.drafts?.length} draf`);
ok("teks sumber terlalu pendek ditolak", (await call("POST", "/api/ai/extract-notes", { token: A, body: { opkCategory: "Ritus", text: "pendek" } })).s === 400);
const fake = new FormData(); fake.append("spotId", sp.id); fake.append("image", new Blob([new Uint8Array(20000)], { type: "image/jpeg" }), "x.jpg");
ok("scan file palsu 415", (await call("POST", "/api/ai/lens-verify", { token: V, form: fake })).s === 415);
ok("scan tanpa foto (JSON) ditolak", (await call("POST", "/api/ai/lens-verify", { token: V, body: { spotId: sp.id, sampleId: "x" } })).s === 400);

// ---- peran & akun
ok("mitra PENDING ditolak kelola", (await call("POST", "/api/spots", { token: (await reg("Calon Baru", "MERCHANT")).token, body: evil })).j.code === "ACCOUNT_NOT_APPROVED");
ok("akun uji demo tidak bisa dihapus", (await call("DELETE", "/api/me", { token: MD, body: { password: "demo1234" } })).j.code === "DEMO_ACCOUNT_LOCKED");
ok("tamu tidak lihat catatan AI", pub.j.aiTrainingNotes.length === 0);
ok("route tak dikenal 404 JSON", (await call("GET", "/api/ngawur")).j.code === "NOT_FOUND");
ok("JSON rusak = 400 bukan 500", (await fetch(B + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{rusak" })).status === 400);

const t = [];
for (let i = 0; i < 15; i++) t.push((await call("GET", "/api/spots")).ms);
t.sort((a, b) => a - b);
ok("latensi GET /api/spots", true, `median ${t[7]}ms, p90 ${t[13]}ms`);

// ---- batas login per IP (paling akhir: stlh ini IP uji kena jeda 10 menit)
const lg = [];
for (let i = 0; i < 65; i++) lg.push((await call("POST", "/api/auth/login", { body: { email: `nebak${i}${rnd}@t.id`, password: "salahsalah" } })).s);
ok("login: 60+ percobaan email beda dr 1 IP diblok 429", lg.includes(429) && lg.indexOf(429) <= 61, `429 mulai ke-${lg.indexOf(429) + 1}`);

for (const r of R) console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.info !== "" ? `  [${r.info}]` : ""}`);
const failed = R.filter((r) => !r.pass).length;
console.log(`\n${R.length - failed}/${R.length} lulus`);
process.exitCode = failed ? 1 : 0;
