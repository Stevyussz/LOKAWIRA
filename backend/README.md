# LOKAWIRA Backend

Service API mandiri untuk proyek LOKAWIRA. Backend memakai TypeScript, Fastify 5, PostgreSQL, Zod, dan Nodemailer. Frontend Next.js tetap menggunakan `src/lib/api.ts`; service ini memenuhi origin backend terpisah yang dijelaskan dalam [`BACKEND_INTEGRATION.md`](../BACKEND_INTEGRATION.md). Route `src/app/api/*` adalah server demo dan tidak diganti oleh service ini.

## Arsitektur

- `src/server.ts`: konfigurasi HTTP, CORS, sesi, validasi, otorisasi, dan seluruh route `/api/*`.
- `src/db.ts`: koneksi PostgreSQL memakai pool `pg` dan helper migrasi.
- `src/migrate.ts`: perintah untuk menerapkan skema secara terpisah.
- `schema.sql`: tabel akun, sesi, profil, token sekali pakai, limiter, audit redeem, dan entitas JSONB.
- `tsconfig.json`: konfigurasi TypeScript service dengan tipe bersama dan seed dari `src/`.
- `src/types/lokawira.ts` dan `src/types/api.ts`: kontrak data yang dipakai frontend; validasi runtime dilakukan terpisah oleh Zod atau validator per endpoint.

Service menyediakan 37 route API. Service seed titik awal dari `INITIAL_CULTURAL_SPOTS` saat start; `INSERT ... ON CONFLICT DO NOTHING` menjaga data yang telah diubah tidak ditimpa saat restart. Akun ADMIN bootstrap dibuat hanya jika `ADMIN_EMAIL` dan `ADMIN_PASSWORD` tersedia dan email belum ada. Tidak ada akun demo bawaan.

### Persistensi

Entitas spot, voucher, reservasi, check-in, catatan AI, dan foto referensi berada di `entities`. Payload aplikasi disimpan sebagai JSONB, dengan kolom `kind`, `owner_id`, dan `created_at` untuk query lintas jenis. Foto disimpan sebagai `bytea`. Akun, sesi, profil, token email/sandi, rate limit, dan audit redeem memiliki tabel terpisah.

Indeks unik menjamin keunikan email, token sesi, kode voucher, kode check-in, dan nomor tiket. Redeem, verifikasi check-in, pemakaian tiket, penerbitan scan harian, dan check-in harian memakai transaksi/penguncian PostgreSQL untuk mencegah pemakaian ganda.

## Prasyarat dan Menjalankan

1. Node.js yang didukung oleh Next.js 15 dan PostgreSQL 14 atau lebih baru.
2. Buat database PostgreSQL kosong serta user database terbatas untuk service.
3. Salin `backend/.env.example` menjadi `backend/.env`.
4. Ganti `SESSION_SECRET` dengan nilai acak minimal 32 karakter. Isi `DATABASE_URL`, `CORS_ORIGINS`, dan kredensial ADMIN bootstrap. Jangan commit file env.
5. Jalankan `npm install`.
6. Jalankan `npm run backend:dev`. Service menerapkan skema, seed titik awal, membuat ADMIN bootstrap bila dikonfigurasi, lalu listen di `BACKEND_HOST:BACKEND_PORT` (default `0.0.0.0:4000`).
7. Arahkan frontend dengan `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000` di `.env.local`. Mode sesi default Bearer, sehingga `NEXT_PUBLIC_API_CREDENTIALS` tetap `same-origin`.

Perintah lain:

- `npm run backend:migrate`: menerapkan skema tanpa menjalankan HTTP service.
- `npm run backend:start`: menjalankan service tanpa watcher.
- `npm run backend:typecheck`: typecheck khusus service.
- `npm run lint` dan `npm run build`: pemeriksaan frontend yang sudah ada.

Service dan migrasi membaca `backend/.env`. Di deployment production, lebih baik injeksikan variabel dari secret manager/service manager dan jangan menaruh secret di image atau source control.

## Konfigurasi

| Variabel | Fungsi |
| --- | --- |
| `DATABASE_URL` | URL PostgreSQL; wajib. |
| `DATABASE_SSL` | `true` mengaktifkan TLS dan verifikasi sertifikat PostgreSQL. |
| `DB_POOL_SIZE` | Maksimum koneksi pool, default 10. |
| `BACKEND_HOST` | Alamat bind, default `0.0.0.0`. Batasi akses lewat firewall/reverse proxy. |
| `BACKEND_PORT` | Port HTTP, default 4000. |
| `CORS_ORIGINS` | Daftar origin frontend dipisahkan koma; gunakan origin tepat, bukan `*`. |
| `SESSION_SECRET` | Rahasia HMAC untuk `signatureHash` voucher; minimal 32 karakter dan wajib. Rotasi memerlukan kebijakan untuk voucher yang sudah diterbitkan. |
| `SESSION_MODE` | `bearer` (default) atau `cookie`. Token sesi disimpan dalam DB sebagai SHA-256, berlaku 30 hari. |
| `GEOFENCE_ENABLED` | `true` untuk mewajibkan koordinat saat check-in dan scan; default `false`. |
| `GEOFENCE_RADIUS_METERS` | Radius server dalam meter; default 100. |
| `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Opsional; buat akun ADMIN pertama kali. Tidak mereset password akun yang sudah ada. |
| `NINE_ROUTER_BASE_URL`, `NINE_ROUTER_API_KEY`, `NINE_ROUTER_MODEL` | Integrasi storyteller/verifikasi foto. Tanpa API key, storyteller menggunakan kurasi dan scanner tidak menerbitkan hadiah. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Pengiriman tautan reset sandi/verifikasi email. |
| `FRONTEND_URL` | Origin frontend untuk tautan email. |

Untuk sesi cookie lintas origin, set `SESSION_MODE=cookie`, `NEXT_PUBLIC_API_CREDENTIALS=include`, gunakan HTTPS, dan set origin frontend di `CORS_ORIGINS`. Cookie beratribut `HttpOnly`, `Secure`, `SameSite=None`; mutasi cookie juga memeriksa header `Origin`. Bearer adalah mode default yang cocok dengan klien saat ini.

CORS mengizinkan `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`, serta header `Authorization` dan `Content-Type`, sesuai metode aktual di kontrak.

## Kontrak API

Semua route menggunakan prefix `/api`. Kecuali upload dan GET gambar, payload adalah JSON. Error berbentuk `{ "error": "...", "code": "...", "details": {} }`; `code` dan `details` hanya dikirim jika relevan. Cursor bersifat buram untuk klien.

### Publik dan Pengunjung

| Method dan path | Request / perilaku | Response utama | Akses |
| --- | --- | --- | --- |
| `GET /api/health` | Tidak ada body. Mengembalikan versi, waktu, radius geofence bila aktif. | `{ ok, version, time, checkInRadiusMeters? }` | Publik |
| `GET /api/spots?vibe=&limit=&cursor=` | Snapshot titik yang terlihat; query filter/pagination. | `{ spots, vouchers, reservations, aiTrainingNotes, nextCursor? }` | Publik / peran |
| `POST /api/reservations` | `{ spotId, visitorName, partySize, scheduledSlot?, acceptCircularQuest }` | `{ reservation, bonusVoucher?, reservations, vouchers }` | Publik |
| `POST /api/checkins` | `{ spotId, lat?, lng?, accuracyMeters? }`; GPS mentah tidak disimpan. | `{ checkIn, awardedPoints }` | Publik |
| `POST /api/ai/lens-verify` | Multipart `spotId`, `image` (JPEG/PNG/WebP maks. 5 MB), lokasi opsional sesuai geofence. JSON `sampleId` tidak digunakan sebagai verifikasi production. | `LensVerificationResult` | Publik |
| `POST /api/ai/storyteller` | `{ spotId, customQuestion? }` | Detail spot + `sourceMode`, `story`, `riddle` | Publik |
| `GET /api/spots/:id/reference-images/:imageId` | Mengirim file image dengan MIME tersimpan. | Binary image | Publik |

Snapshot tamu tidak membocorkan voucher/reservasi. Visitor login menerima item miliknya. Merchant menerima voucher milik spot sendiri dan tidak menerima reservasi dalam snapshot. Admin menerima seluruh voucher/reservasi dari snapshot, mengikuti kompatibilitas halaman `/merchant-pos` yang masih memerlukannya. Catatan AI hanya dikirim kepada ADMIN.

Reservasi memberi 75 XP untuk akun login. Check-in memberi 50 XP dan kode `KDR-######`. Bonus voucher hanya diterbitkan bila diminta dan ada spot UMKM milik merchant ACTIVE di vibe yang sama; nilai promo berasal dari spot merchant tersebut. Jika tidak ada merchant yang cocok, `bonusVoucher` tidak dikirim.

### Autentikasi dan Profil

| Method dan path | Request / perilaku | Response utama | Akses |
| --- | --- | --- | --- |
| `POST /api/auth/register` | `{ name, email, password, role }`; role hanya VISITOR/MERCHANT, password min. 8. | `{ token?, user }`, status 201; merchant mulai PENDING | Publik |
| `POST /api/auth/login` | `{ email, password }`; pesan kredensial salah tidak membedakan email/sandi. | `{ token?, user }` | Publik |
| `GET /api/auth/me` | Sesi saat ini. | `{ user }` | Login |
| `POST /api/auth/logout` | Body `{}`. Menghapus sesi saat ini. | `{ ok: true }` | Login |
| `GET /api/me/profile` | Tidak ada body. Level dihitung `floor(xp / 150) + 1`. | `{ xp, level, checkedInSpotIds, loreCards, vouchers, reservations }` | Login |
| `POST /api/auth/forgot-password` | `{ email }`; respons selalu `{ ok: true }`, tidak mengungkap apakah email terdaftar. | `{ ok: true }` | Publik |
| `POST /api/auth/reset-password` | `{ token, password }`; password min. 8. Token satu kali, 30 menit. | `{ ok: true }` | Publik |
| `POST /api/auth/change-password` | `{ currentPassword, newPassword }`; cabut sesi lama dan terbitkan sesi baru. | `{ ok: true, token? }` | Login |
| `DELETE /api/me` | `{ password }`; arsip spot merchant dan anonimisasi record terkait. | `{ ok: true }` | Login |
| `POST /api/auth/verify-email` | `{ token }`; token satu kali, 24 jam. | `{ ok: true }` | Publik |
| `POST /api/auth/resend-verification` | Tidak ada body; limit satu permintaan per menit. | `{ ok: true }` | Login |

### Spot, Merchant, Admin

| Method dan path | Request / perilaku | Response utama | Akses |
| --- | --- | --- | --- |
| `POST /api/spots` | Body langsung `CulturalSpot`; ID/owner/status/waktu ditentukan server; spot merchant PENDING_REVIEW. | `{ spot, spots }`, status 201 | MERCHANT aktif / ADMIN |
| `PATCH /api/spots/:id` | Partial update; field status/owner dilarang. Field sensitif hanya ADMIN. | `{ spot, spots }` | Pemilik / ADMIN |
| `DELETE /api/spots/:id` | Soft delete ke ARCHIVED. | `{ spots }` | Pemilik / ADMIN |
| `PATCH /api/spots/:id/quota` | `{ currentVisitors }`; server membatasi ke 0..maxCapacity dan menghitung waktu tunggu. | `{ spot, spots }` | ADMIN |
| `PUT /api/spots/:id/promo` | `{ discountTitle, discountAmount, minimumSpend, rewardPoints? }`; poin hanya dapat diubah ADMIN. | `{ spot, spots }` | Pemilik / ADMIN |
| `POST /api/spots/:id/reference-images` | Multipart field `image`; maks. 5 file/spot, 5 MB, JPEG/PNG/WebP dan signature file diperiksa. | `{ referenceImages }` | Pemilik / ADMIN |
| `DELETE /api/spots/:id/reference-images/:imageId` | Hapus foto dan kembalikan daftar terbaru. | `{ referenceImages }` | Pemilik / ADMIN |
| `GET /api/admin/merchants?status=&limit=&cursor=` | Daftar merchant, status dan jumlah spot. | `{ merchants, nextCursor? }` | ADMIN |
| `POST /api/admin/merchants/:id/approve` | Aktifkan merchant. | `{ merchant }` | ADMIN |
| `POST /api/admin/merchants/:id/reject` | `{ reason? }`, alasan maks. 200 karakter. | `{ merchant }` | ADMIN |
| `POST /api/admin/spots/:id/review` | `{ decision: PUBLISH\|REJECT, reason? }`. Hanya spot PENDING_REVIEW dapat diputuskan. | `{ spot, spots }` | ADMIN |
| `POST /api/ai-notes` | `{ opkCategory, maestroSource, summary }` | `{ aiTrainingNotes }`, status 201 | ADMIN |
| `PATCH /api/ai-notes/:id` | Partial update; sumber min. 5, ringkasan min. 20 karakter. | `{ aiTrainingNotes }` | ADMIN |
| `DELETE /api/ai-notes/:id` | Hapus catatan. | `{ aiTrainingNotes }` | ADMIN |

Merchant PENDING/REJECTED tidak dapat melakukan aksi yang memerlukan merchant aktif. Spot yang belum PUBLISHED tidak tampil publik. Merchant hanya dapat mengubah spot miliknya; perubahan nama/koordinat mengembalikan status ke PENDING_REVIEW. Kategori, vibe, region, spot type, sumber lore terverifikasi, dan reward points adalah field admin-only.

### Kasir, Check-in, dan Admin Lists

| Method dan path | Request / perilaku | Response utama | Akses |
| --- | --- | --- | --- |
| `POST /api/checkins/verify` | `{ code }`; sekali pakai, reward masuk ke pemilik akun yang check-in. | `{ verified, spotId, spotName, awardedPoints }` | Merchant pemilik / ADMIN |
| `POST /api/vouchers/redeem` | `{ code }`; input `######` atau `LKW-######`; transaksi idempoten. | `{ redeemedVoucher, vouchers }` | Merchant pemilik / ADMIN |
| `POST /api/reservations/checkin` | `{ ticketId }`; tandai tiket digunakan, sekali pakai. | `{ reservation, reservations }` | ADMIN |
| `GET /api/admin/reservations?spotId=&status=&from=&to=&limit=&cursor=` | Daftar E-Ticket terfilter dan terpaginasikan. | `{ reservations, nextCursor? }` | ADMIN |
| `GET /api/admin/vouchers?spotId=&status=&limit=&cursor=` | Daftar voucher terfilter dan terpaginasikan. | `{ vouchers, nextCursor? }` | ADMIN |

## Aturan Keamanan dan Kode Error

- Otorisasi ditegakkan server-side. `RequireRole` frontend hanya untuk UX.
- Password di-hash dengan `scrypt`; token sesi acak tidak disimpan plaintext, hanya SHA-256 hash. Sesi berlaku 30 hari.
- Error umum: 400 `BAD_REQUEST`, 401 `UNAUTHENTICATED`/`BAD_CREDENTIALS`, 403 `FORBIDDEN`/`NOT_YOUR_SPOT`/`NOT_YOUR_VOUCHER`/`ACCOUNT_NOT_APPROVED`/`OUT_OF_RANGE`, 404, 409 `VOUCHER_ALREADY_REDEEMED`/`CHECKIN_ALREADY_VERIFIED`/`TICKET_ALREADY_USED`/`ALREADY_CHECKED_IN_TODAY`, 413 `IMAGE_TOO_LARGE`, 415 `IMAGE_TYPE_UNSUPPORTED`, 429 `RATE_LIMITED`, 5xx `INTERNAL_ERROR`.
- Rate limits PostgreSQL-backed: login 5 kegagalan per email/60 detik; register per IP; reservasi per IP; voucher redeem per akun; forgot-password per IP; resend verification per akun. Scanner belum memiliki rate limit request tersendiri, meski penerbitan hadiah dibatasi satu per visitor/spot/hari.
- Geofence dihitung server dengan Haversine. `accuracyMeters > 100` ditolak; jarak di luar radius menghasilkan `details.distanceMeters` dan `details.radiusMeters`. Check-in harian dan cek kecepatan antar lokasi juga ditegakkan. GPS browser tetap dapat dipalsukan.
- Akun tamu tidak memiliki device ID pada kontrak frontend; limiter tamu menggunakan hash IP. Pengunjung di NAT dapat berbagi batas dan IP berganti dapat menghindarinya.
- Cookie lintas origin hanya boleh dipakai lewat HTTPS dan origin yang diizinkan. API membatasi `Origin` pada operasi mutasi cookie.

## Menambah Perubahan

- Pertahankan satu pintu API frontend di `src/lib/api.ts` dan sesuaikan tipe di `src/types/api.ts` bila kontrak berubah.
- Tambahkan validasi runtime untuk input eksternal; tipe TypeScript tidak memvalidasi payload saat runtime.
- Perubahan skema harus idempotent di `schema.sql` dan diuji di PostgreSQL bersih maupun database upgrade.
- Perubahan status/owner/promo harus punya pemeriksaan role dan kepemilikan server-side.
- Operasi sekali pakai, saldo/XP, dan penerbitan kode wajib memakai constraint/transaksi database.
- Sertakan pengujian untuk sukses, invalid input, unauthorized, konflik, dan concurrency. Saat ini belum ada suite integrasi backend yang terhubung ke PostgreSQL.

## Deploy dan Operasional

- Deploy service di VPS di belakang reverse proxy TLS; frontend Vercel hanya mengakses endpoint backend melalui `NEXT_PUBLIC_API_BASE_URL`.
- Izinkan akses publik hanya ke port reverse proxy; PostgreSQL jangan diekspos ke internet.
- Backup PostgreSQL dan uji pemulihan. Tentukan retensi lokasi, voucher, check-in, audit, serta image sesuai kebijakan privasi sebelum produksi.
- Tambahkan monitoring koneksi DB, latency, error rate, backup, kapasitas bytea, dan alert. `/api/health` saat ini hanya memberi liveness sederhana, belum memeriksa database.
- Gunakan session secret/SMTP/AI key dari secret manager. Jangan memakai akun contoh Next.js di production.
- Uji CORS dan alur sesi dari domain frontend staging/production sebelum mengalihkan traffic.

## Batas yang Perlu Diketahui

- Belum ada suite test integrasi PostgreSQL dan belum dilakukan smoke test ke DB di lingkungan pengembangan.
- Backend menggunakan tabel entitas JSONB generik; cocok untuk implementasi awal, tetapi query/paginasi saat ini memuat beberapa daftar ke memori dan tidak ideal untuk volume besar.
- `limit/cursor` saat ini memakai offset yang di-encode Base64, bukan cursor stabil; perubahan data selama pagination dapat menggeser hasil.
- Endpoint scanner belum memiliki rate limit per IP/akun sebelum memanggil provider AI. Tambahkan pembatasan sebelum production agar biaya/provider tidak mudah disalahgunakan.
- Rate limiter berbagi state di PostgreSQL, tetapi key IP bergantung pada konfigurasi proxy (`trustProxy` aktif). Batasi proxy tepercaya di deployment agar header IP tidak dapat dipalsukan.
- Email verification tersedia di API namun belum diwajibkan saat login. UI verifikasi email belum tersedia.
- `/api/auth/forgot-password` selalu mengembalikan `{ ok: true }`; bila SMTP tidak dikonfigurasi, pesan tidak dikirim dan token tidak dibuat. SMTP wajib untuk mengaktifkan alur tersebut.
- Scan foto menggunakan NineRouter multimodal dengan ambang confidence 0.65. Tanpa key, tidak ada XP/voucher. Hasil model harus diuji pada dataset budaya nyata sebelum dianggap valid untuk operasional.
- Foto referensi disimpan sebagai PostgreSQL `bytea`; belum ada antivirus, object storage, thumbnail, atau kebijakan pembersihan file terarsip.
- Reservasi tidak mengunci kapasitas aktual; kuota masih input manual admin. Perlu aturan kapasitas/transaksi bisnis jika kuota menjadi reservasi nyata.
- XP/reservasi/check-in tersebar di beberapa query; perubahan kritis selanjutnya sebaiknya membungkus seluruh mutasi terkait dalam transaksi.
- Service TypeScript diperiksa dengan typecheck dan build frontend, tetapi tanpa PostgreSQL lokal perilaku SQL belum dapat diverifikasi secara end-to-end.
