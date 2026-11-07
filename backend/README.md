# LOKAWIRA Backend

Service API LOKAWIRA: TypeScript, Fastify 5, PostgreSQL, Zod, Nodemailer. Frontend Next.js (branch `main`) memanggilnya lewat `src/lib/api.ts` dengan `NEXT_PUBLIC_API_BASE_URL`. Kontraknya sama persis dengan server contoh di `src/app/api/*` milik frontend (yang tetap dipakai untuk mode demo).

Branch `backend` ini berdiri sendiri: aturan bisnis yang di `main` dibagi bersama frontend (`src/lib/*`, `src/types/lokawira.ts`) disalin ke `shared/` dan diimpor lewat alias `@/`. **Kalau aturan di `main` berubah, salin ulang file yang sama ke `shared/`** supaya dua sisi tidak beda logika.

## Struktur

| Berkas | Isi |
| --- | --- |
| `src/server.ts` | Bootstrap Fastify, CORS, multipart, error handler, health (ikut cek DB), pembersihan berkala. |
| `src/http.ts` | Sesi (Bearer atau cookie), `requireRoles`, akun uji terkunci. |
| `src/core.ts` | Helper DB, visibilitas titik, kawasan, klaim hadiah harian, limiter, kode unik, HMAC voucer. |
| `src/geofence.ts` | Cek jarak check-in/pindai (koordinat mentah tidak disimpan). |
| `src/routes/auth.ts` | Daftar, masuk, profil, ganti/lupa sandi, hapus akun, verifikasi email. |
| `src/routes/spots.ts` | Titik budaya, kuota, promo, foto contoh. |
| `src/routes/economy.ts` | Check-in, verifikasi KDR, E-Ticket, voucer pengalih, kasir. |
| `src/routes/ai.ts` | Loka (storyteller), pindai objek multimodal, Pengetahuan Loka. |
| `src/routes/admin.ts` | Persetujuan mitra/titik, daftar tiket dan voucer. |
| `src/routes/agenda.ts` | Kawasan, acara budaya, metrik dampak. |
| `src/seed.ts` | Isi awal idempoten: kawasan, titik, acara, rujukan; admin pertama; akun uji opsional. |
| `shared/` | Salinan aturan bersama dari frontend (`lib/*`, `types/lokawira.ts`). |
| `schema.sql` | Skema idempoten (aman dijalankan ulang). |
| `qa/smoke.mjs` | 59 cek QA: alur penuh dan celah eksploit lama. |
| `qa/ai.mjs` | 8 cek AI nyata lewat 9router (Loka live, foto cocok/ditolak, batas hadiah). Butuh folder foto `celengan.jpg` dan `batik.jpg`. |

Aturan yang dipakai bersama frontend dan server contoh (di branch ini ada di `shared/lib/`): `spotRules.ts` (cara masuk, jam buka, zona waktu, `openState`), `eventRules.ts` (kemunculan acara), `regionMatch.ts`, `server/regionInput.ts`, `server/loreContext.ts`, `enums.ts`, `geo.ts`, `nineRouterClient.ts`, `seedCulturalData.ts`.

## Menjalankan

1. Node 20+ dan PostgreSQL 14+. Buat database kosong dan user terbatas.
2. Masuk ke folder `backend/`, lalu `cp .env.example .env`, lalu isi `DATABASE_URL`, `SESSION_SECRET` (acak, minimal 32 karakter), `CORS_ORIGINS`, dan `ADMIN_EMAIL`/`ADMIN_PASSWORD`.
3. `npm install`, lalu `npm run dev`. Skema diterapkan, data awal diisi, lalu server listen di `BACKEND_HOST:BACKEND_PORT`.
4. Frontend: `NEXT_PUBLIC_API_BASE_URL=https://api.domainmu.id` (tanpa garis miring akhir). Mode demo frontend dimatikan.

Perintah lain (semua dari folder `backend/`): `npm start`, `npm run migrate`, `npm run typecheck`, `B=http://localhost:4000 npm run qa` (butuh `DEMO_ACCOUNTS=true` dan `GEOFENCE_ENABLED=true`), `B=http://localhost:4000 npm run qa:ai -- <folder-foto>`.

Penjurian: set `DEMO_ACCOUNTS=true` supaya akun uji `wisatawan@`, `mitra@`, `calon@`, `admin@lokawira.demo` (sandi `DEMO_PASSWORD`) tersedia. Akun ini tidak bisa diganti sandinya atau dihapus. Matikan setelah penjurian.

## Persistensi

- `entities`: spot, region, event, voucher, reservation, checkin, ai-note, reference-image (JSONB, foto sebagai `bytea`). Indeks unik untuk kode voucer, KDR, dan nomor tiket.
- `users`, `sessions` (hanya hash SHA-256 token, 30 hari), `profiles` (XP, kartu kisah), `one_time_tokens`, `rate_limits`, `redemption_audit`.
- `reward_log`: primary key (akun, titik, jenis, hari WIB). Inilah yang membuat hadiah hanya bisa diklaim sekali per hari, dan tetap atomik walau ada permintaan serentak.
- `metrics`: hanya jenis, titik, dan waktu. Tanpa akun, IP, atau lokasi (UU PDP).

## Aturan penting (ditegakkan server)

- **Titik:** body `POST /api/spots` disaring per field. XP misi mitra dipaksa 100. Sumber terverifikasi, acara bertanggal, dan jenis/OPK lewat PATCH hanya boleh diubah pengelola. Kapasitas: mitra ≤500, pengelola ≤5.000. Pin wajib di Indonesia (`OUT_OF_INDONESIA`). Kawasan, palet, dan nama kawasan dihitung dari koordinat. Lapak di luar kawasan diterima sebagai usulan dan tidak bisa terbit (`NO_REGION`). PATCH bersifat atomik (baris dikunci, semua field divalidasi dulu).
- **Publik** hanya melihat titik yang terbit, berada di kawasan ACTIVE, pemiliknya aktif, dan acaranya belum selesai.
- **Check-in:** satu per titik per hari WIB, `CLOSED_NOW` di luar jam buka, geofence opsional dengan cek perpindahan mustahil. KDR sekali pakai dan berlaku 24 jam (`CHECKIN_EXPIRED`).
- **E-Ticket:** hanya untuk titik RESERVATION/TICKET (`NO_BOOKING_NEEDED`). XP sekali per titik per hari. Voucer pengalih hanya untuk akun, sekali per lapak per hari, berlaku sampai 23.59 WIB.
- **Kasir:** voucer dikunci `FOR UPDATE` (tebus serentak, hanya 1 yang sukses), hanya di lapak penerbitnya, ditolak 410 `VOUCHER_EXPIRED` bila lewat masa berlaku.
- **Pindai objek:** wajib foto JPEG/PNG/WebP asli (signature dicek). Diverifikasi model multimodal 9router (ambang keyakinan 0,65, dibandingkan dengan foto contoh mitra). Kisah tetap diambil dari narasi kurasi, bukan karangan model. Hadiah hanya untuk akun, sekali per titik per hari. Dibatasi 20 pindai per 10 menit per akun/IP. Tanpa API key: tidak ada voucer.
- **9router:** permintaan dikirim `stream:false` (9router membalas SSE bila tidak diminta), balasan JSON yang dibungkus ```json tetap dibaca, dan `NINE_ROUTER_MODEL`/`NINE_ROUTER_VISION_MODEL` berupa daftar cadangan dengan batas waktu per model. Saat diuji, salah satu penyedia (gemini/gemini-3.8-flash) sempat putus dan cadangan langsung mengambil alih.
- **Loka:** cerita hanya dari rujukan (`[R0]` narasi titik + maksimal 3 rujukan Pengetahuan Loka). Respons menyertakan `references`. Bila AI gagal atau timeout, narasi kurasi dipakai.
- **Limiter:** login 5 gagal per email per menit; daftar 10/jam per IP; reservasi 30/jam per IP; tebus 120/jam per akun; Loka 40 per 10 menit; metrik 30/jam per jenis/titik/IP.

## Deploy

- Jalankan di VPS di belakang reverse proxy TLS (Caddy/Nginx). Isi `TRUST_PROXY` dengan IP proxy supaya IP asli terbaca oleh limiter. Jangan buka port Postgres ke internet.
- Contoh systemd: `ExecStart=/usr/bin/npm start`, `WorkingDirectory=/srv/lokawira/backend`, `EnvironmentFile=/etc/lokawira/backend.env`, `Restart=always`.
- Frontend Vercel: `NEXT_PUBLIC_API_BASE_URL` diarahkan ke domain API, dan domain Vercel ditambahkan ke `CORS_ORIGINS`.
- Backup Postgres harian (`pg_dump`) dan uji pemulihan. `/api/health` mengembalikan 503 bila DB putus, jadi cocok untuk monitor uptime.

## Batas yang diketahui

- Data JSONB generik dengan beberapa daftar dimuat ke memori. Cukup untuk ratusan titik dan ribuan transaksi; untuk skala besar pindahkan spot/voucer ke tabel berkolom dan paginasi berbasis keyset.
- Kuota kepadatan masih diisi manual oleh pengelola (belum otomatis dari tiket/check-in).
- Foto contoh disimpan di Postgres (`bytea`), belum di object storage.
- GPS browser tetap bisa dipalsukan. Geofence adalah penghalang, bukan bukti mutlak (makanya ada verifikasi KDR oleh pemilik lapak).
