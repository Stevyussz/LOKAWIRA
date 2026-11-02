
Ini catatan buat nyambungin frontend ke backend. Aku tulis dari kode yg bneran ada skarang. Kalo ada yg gak cocok sama kode/ada yang cacat tag gw(stevyusS) biar gw tanganin bagian frontendny, jangan ubah/sentuh desain uiux yg udh ada ya / ngerubah stylingny. kalo ada perlu apa apa sama frontend langsung tag gw

File yg perlu dibaca duluan:
- src/types/lokawira.ts : bentuk data entitas (spot, voucher, tiket, dll)
- src/types/api.ts : bentuk request dan response tiap endpoint. Backend TS bisa langsung copy atau import dua file types ini, gak ada dependency runtime
- src/lib/api.ts : satu-satunya pintu frontend ke server, komponen gak boleh manggil fetch langsung
- src/app/api/* dan src/lib/server/mockBackend.ts : server contoh di memori, ini cuma referesni perilaku dan BUKAN buat produksi, hapus kalo backend aslinya udah jadi

Arsitektur sesuai alur flowteknis: frontend Next.js di Vercel, backend di VPS, database buat reservasi, user, dan peta.

BAGIAN 1 - Cara nyambungin (3 langkah)(BACA DULU SAMPE ABIS!)

- Langkah 1: copy .env.example jadi .env.local, lalu isi NEXT_PUBLIC_API_BASE_URL dgn alamat backend, contoh https://api.contoh.id (tanpa slash di akhir).
- Langkah 2: di produksi biarin NEXT_PUBLIC_DEMO_MODE kosong. Mode demo itu cuma buat demo jurri (data contoh, akun demo, server contoh). Di build produksi dia mati otomtis kalo env nya kosong, dan route contoh di src/app/api bakal nolak semua request dgn status 503 kode MOCK_DISABLED. Jadi gak bakal ada akun demo yg kebawa ke produksi walaupun lupa ngisi env.
- Langkah 3: bikin endpoint di bagian 4(LIAT DIBAWAH UDH GW BKININ LISTNY) dgn bentuk JSON yg sama persis. Folder src/app/api/*, src/lib/server/, dan fungsi getLokawiraStore itu GAK wajib dihapus. Kalo NEXT_PUBLIC_API_BASE_URL udh keisi, frontend gak pernah manggil mereka (semua request lewat src/lib/api.ts ke alamat backend), dan kalo mode demo mati mereka nolak semuanya dgn 503. Baru hapus kalo backend aslinya udh jalan DAN demo juri udh kelar, soalnya demo juri masih butuh server contoh ini. Jgn hapus file src/lib/seedCulturalData.ts nya, cuma fungsi getLokawiraStore, karena data contoh di dalamnya masih dipake browser (mode demo, sampel scanner, warna kawasan).

Soal CORS: Vercel ke VPS itu beda origin, jadi backend wajib atur CORS.
- Access-Control-Allow-Origin diisi domain frontend (jangan bintang kalo pake cookie)
- Metode: GET, POST, OPTIONS
- Header yg diizinkan: Authorization dan Content-Type

Ada dua cara sesi, pilih salah satu:
- Cara token Bearer (default): respons login ngasih field token, frontend nyimpen di localStorage dgn key lokawira.token dan ngirim header Authorization: Bearer (token) di tiap request.
- Cara cookie httpOnly (lebih aman, disaranin buat produksi): respons login TANPA field token, server set cookie dgn Secure, HttpOnly, SameSite=None. Di frontend set NEXT_PUBLIC_API_CREDENTIALS=include, dan backend kirim Access-Control-Allow-Credentials: true. Pake cara ini browser gak nyimpen token sama sekali.


BAGIAN 2 - Format error standar

Semua endpoint kalo gagal balikin status 4xx atau 5xx dgn body JSON begini: {"error": "pesan buat user, bahasa Indonesia", "code": "KODE_OPSIONAL"}

- Isi field error ditampilin apa adanya ke user, jadi tulis yg ramah dan jelas.
- Field code opsional tapi lebih bagus kalo ada, biar frontend bisa bedain kasusnya.
- Status yg dikenali UI: 400 input salah, 401 belum masuk, 403 peran atau kepemilikan gak cukup, 404 gak ketemu, 409 konflik (udah ditebus, udah diverifikasi, email kepake), 429 kebanyakan percobaan, 5xx server error.
- Jaringan mati dan timeout diurus frontend sendiri. Timeout biasa 15 detik, endpoint AI (lens-verify dan storyteller) 30 detik.

Daftar kode yg udah dipake server contoh (tiru aja):
- UNAUTHENTICATED (401) : belum login atau sesi abis
- FORBIDDEN (403) : peran gak cukup
- BAD_CREDENTIALS (401) : email atau sandi salah, pesannya sengaja disamain biar akun gak bisa ditebak
- RATE_LIMITED (429) : 5 kali gagal login per email, dikunci 60 detik
- EMAIL_TAKEN (409) : email udah terdaftar
- NOT_YOUR_SPOT (403) : mitra ngurus lapak orang lain
- NOT_YOUR_VOUCHER (403) : mitra nebus voucer lapak lain
- VOUCHER_ALREADY_REDEEMED (409) : voucer udah pernah ditebus
- CHECKIN_NOT_FOUND (404) : kode kehadiran gak ada
- CHECKIN_ALREADY_VERIFIED (409) : kode kehadiran udah diverifikasi
- TICKET_ALREADY_USED (409) : E-Ticket udah dipake masuk
- MOCK_DISABLED (503) : khusus server contoh, artinya mode demo mati


BAGIAN 3 - Peran dan aturan akses

Ada tiga peran: VISITOR (wisatawan), MERCHANT (mitra UMKM atau sanggar), ADMIN (pengelola).

- Wisatawan BOLEH tanpa akun, sesuai alur pengguna yg gak pake login. Akun wisatawan cuma opsional.
- Mitra dan pengelola wajib login. Halaman /merchant-pos nerima MERCHANT dan ADMIN, halaman /admin cuma ADMIN.
- Admin gak bisa daftar sendiri, akunnya dibikin sistem.
- Penjaga halaman di frontend (RequireRole) itu cuma buat tampialn. Keamanan yg sebenernya HARUS di backned, jangan ngandelin frontend.

Aturan per aksi yg udah dijalnin server contoh (tiru persis):
- Lihat peta, titik, kuota: semua boleh (tamu, wisatawan, mitra, admin)
- Reservasi, scan objek, tanya Ki Narada, check-in: semua boleh
- Tebus voucer (redeem): mitra cuma buat voucer lapaknya sendiri, admin semua. Tamu dan wisatawan gak boleh.
- Tambah titik (ADD_SPOT): mitra boleh, ownerId diisi id dia sendiri, dan gak boleh bikin jenis PRIMARY_DEST. Admin boleh semua jenis. Tamu dan wisatawan gak boleh.
- Atur promo (UPDATE_PROMO): mitra cuma lapaknya sendiri, admin semua dan cuma admin yg boleh ngubah rewardPoints.
- Verifikasi kehadiran: mitra cuma buat lapaknya sendiri, admin semua.
- Ubah kuota, tambah catatan RAG, check-in tiket: cuma admin.

Isi snapshot (GET /api/spots) beda per pearan: mitra cuma nerima voucer yg spotId nya lapak dia, dan reservations dikosongin.

BAGIAN 4 - Kontrak endpoint

Semua body dan response pake JSON. Kalo ada tanda tanya setelah nama field artinya opsional.

Auth

- POST /api/auth/login
  - siapa: tamu
  - request: email, password
  - response: token? dan user (id, name, email, role)
  - error: 400 kalo kosong, 401 BAD_CREDENTIALS, 429 RATE_LIMITED

- POST /api/auth/register
  - siapa: tamu
  - request: name, email, password, role (cuma VISITOR atau MERCHANT)
  - response: token? dan user
  - validasi: name minimal 2 karakter, email format valid, password minimal 8 karakter
  - error: 400 input salah, 409 EMAIL_TAKEN

- GET /api/auth/me
  - siapa: yg udah login
  - response: user
  - error: 401 UNAUTHENTICATED. Frontend nganggep 401 artinya tamu, tapi kalo jaringan mati dia nampilin "server tidak terjangkau" dan BUKAN dilempar ke halaman login.

- POST /api/auth/logout
  - siapa: yg udah login
  - request: body kosong {}
  - response: ok true. Kalo gagal frontend tetep ngeluarin usre di perangkatnya.

Titik dan peta

- GET /api/spots?vibe=
  - siapa: semua
  - query vibe opsional (majapahit, sogan, bahari, tridatu, ukiran)
  - response: spots, vouchers, reservations, aiTrainingNotes (semuanya array)
  - dipanggil pas aplikasi kebuka, dan dipanggil lagi tiap kali user login atau logout karena isinya beda per peran

- POST /api/spots dgn action UPDATE_QUOTA
  - siapa: ADMIN
  - request: action, spotId, currentVisitors
  - response: spot dan spots
  - server ngejepit currentVisitors di antara 0 sampai maxCapacity, dan ngitung estimatedWaitMinutes (rasio 85 persen atau lebih = 35 menit, 60 persen atau lebih = 15, sisanya 0)

- POST /api/spots dgn action ADD_SPOT
  - siapa: MERCHANT, ADMIN
  - request: action dan spot (bentuk CulturalSpot, lihat bagian entitas)
  - response: spot dan spots
  - server yg bikin id, createdAt (ISO), dan ownerId. Id yg dikirim frontend (isinya "draft") diabaikan.
  - validasi: name gak boleh kosong, coordinates.lat dan lng harus angka. Mitra dilarang bikin PRIMARY_DEST (403 FORBIDDEN).

- POST /api/spots dgn action UPDATE_PROMO
  - siapa: MERCHANT (lapak sendiri), ADMIN
  - request: action, spotId, discountTitle, discountAmount, minimumSpend, rewardPoints?
  - response: spot dan spots
  - validasi: discountTitle wajib, discountAmount antara 1000 sampai 100000, minimumSpend 0 atau lebih, rewardPoints cuma dipake kalo yg ngirim ADMIN (0 sampai 1000), buat mitra diabaikan
  - error: 403 NOT_YOUR_SPOT kalo bukan lapaknya

- POST /api/spots dgn action ADD_AI_NOTE
  - siapa: ADMIN
  - request: action, opkCategory, maestroSource, summary
  - response: aiTrainingNotes (daftar lengkap terbaru)

Reservasi dan check-in

- POST /api/reservations
  - siapa: semua
  - request: spotId, visitorName, partySize, scheduledSlot, acceptCircularQuest
  - response: reservation, bonusVoucher?, reservations, vouchers
  - bonusVoucher cuma ada kalo acceptCircularQuest true
  - validasi: visitorName gak boleh kosong (400)

- POST /api/reservations/checkin
  - siapa: ADMIN
  - request: ticketId
  - response: reservation dan reservations
  - error: 404 kalo tiket gak ada, 409 TICKET_ALREADY_USED

- POST /api/checkins
  - siapa: semua
  - request: spotId
  - response: checkIn (id, code, spotId, createdAt) dan awardedPoints
  - server yg nentukan XP (sekarang 50) dan bikin kode kehadiran format KDR- ditambah 6 digit, sekali pake
  - error: 404 kalo spot gak ada

- POST /api/checkins/verify
  - siapa: MERCHANT (lapak sendiri), ADMIN
  - request: code
  - response: verified, spotId, spotName, awardedPoints (diambil dari quest.rewardPoints spot nya)
  - error: 404 CHECKIN_NOT_FOUND, 403 NOT_YOUR_SPOT, 409 CHECKIN_ALREADY_VERIFIED

Voucer

- POST /api/vouchers/redeem
  - siapa: MERCHANT (voucer lapak sendiri), ADMIN
  - request: code
  - response: redeemedVoucher dan vouchers
  - kode boleh ditulis "849201" atau "LKW-849201", huruf besar kecil gak ngaruh
  - harus atomik dan idempoten: kalo dikirim dua kali yg kedua WAJIB 409 VOUCHER_ALREADY_REDEEMED. Frontend sengaja gak nimpa penolakan server pake data lokal lagi.
  - error: 400 kalo kosong, 404 gak ketemu, 403 NOT_YOUR_VOUCHER, 409 udah ditebus

AI

- POST /api/ai/lens-verify
  - siapa: semua
  - request: sampleId, spotId, customImageName?
  - response: LensVerificationResult (lihat entitas), isi issuedVoucher kalo dapet voucer
  - catatan: sekarang BELUM ngirim gambar, cuma sampleId dari sampel kurasi

- POST /api/ai/storyteller
  - siapa: semua
  - request: spotId, customQuestion?
  - response: spotId, spotName, opkCategory, verifiedSource, riddleTitle, isVerified, sourceMode, story, riddle
  - PENTING: logika AI nya (prompt, fallback pas gak ada API key, timeout 3,5 detik ke 9router) cuma ada di src/app/api/ai/storyteller/route.ts dan src/lib/nineRouterClient.ts. Backend harus bikin ulang, jadi jgn hapus dua file itu sebelum logikanya dipindahin.


BAGIAN 5 - Bentuk data (entitas)

- AuthUser: id (string), name, email, role (VISITOR atau MERCHANT atau ADMIN), status? (cuma MERCHANT: PENDING, ACTIVE, REJECTED, usulan bagian 7C)

- CulturalSpot:
  - id, ownerId?, createdAt? (ISO 8601), status? (PENDING_REVIEW, PUBLISHED, REJECTED, ARCHIVED, usulan bagian 7C), name, regionName
  - vibe: majapahit, sogan, bahari, tridatu, atau ukiran
  - spotType: PRIMARY_DEST, SANGGAR_SENI, UMKM_KULINER, atau UMKM_KRIYA
  - opkCategory: Tradisi Lisan, Pengetahuan Tradisional, Teknologi Tradisional & Kriya, Seni Pertunjukan, Adat Istiadat & Ritus, Cagar Budaya, Manuskrif, Permainan Rakyat, Olahraga Tradisional, atau Bahasa
  - coordinates: lat dan lng (angka desimal)
  - address, facilities (array string)
  - quota: currentVisitors, maxCapacity, estimatedWaitMinutes, nextAvailableSlot (teks tampilan, mis "14:30 WIB")
  - quest: riddleTitle, riddleClue, targetObjectPrompt, verifiedLoreSource, loreNarrative, rewardPoints, voucherReward (merchantName, discountTitle, discountAmount, minimumSpend)

- IssuedVoucher: code (format LKW- plus 6 digit), signatureHash, spotId, merchantName, discountTitle, discountAmount (rupiah, bilangan bulat), minimumSpend, expiresAt (ISO 8601 atau null, teks lama masih diterima UI), status (ACTIVE atau REDEEMED), redeemedAt? (ISO 8601, teks lama masih diterima UI)

- ReservationPass: ticketId (mis PASS-MJP-089), spotId, spotName, visitorName, partySize (di UI 1 sampai 6), scheduledSlot (teks mis "14:30 WIB"), status (CONFIRMED atau CHECKED_IN), circularQuestAccepted, createdAt (sekarang teks)

- LensVerificationResult: isVerified, confidenceScore (0 sampai 1), detectedObjectName, culturalStory, opkReference, verifiedSource, awardedPoints, issuedVoucher?, message? (alasan kalo isVerified false, usulan bagian 7E)

- AiTrainingNote: id, opkCategory, maestroSource, summary, updatedAt

- UnlockedLoreCard (dibikin di sisi frontend dari hasil scan, belum ada di server): id, spotId, objectName, opkCategory, verifiedSource, story, unlockedAt, confidenceScore


BAGIAN 6 - Hal2 alur yg harus dijaga

- Promo itu templat, BUKAN voucer. UPDATE_PROMO ngubah spot.quest.voucherReward. Voucer baru cuma lahir dari lens-verify dan dari bonus reservations, pake templat itu. Endpoint lama vouchers/claim udah dihapus karena nerbitin voucer yg langsung nongol di tas wisatawan.
- Alur mitra "pengunjung datang, verifikasi, kasih reward": wisatawan check-in, server kasih kode KDR (sekali pake) dan nentuin XP, mitra masukin kode itu, server nandain udah terverifikasi.
- Titik baru: id, createdAt, dan ownerId dibikin SERVER. createdAt itu penting karena nentuin cagar "jangkar" kawasan (yg paling tua). Kalo gak ada, peta dan jalur pengalihan antrean bisa geser tiap ada cagar baru. Titik tanpa createdAt dianggap paling tua.
- coordinates (lat dan lng) jadi sumber posisi pin di peta. Petanya bergaya (bukan peta dunia), posisinya dihitung relatif ke jangkar kawasan, dan zona 250 meter = radius pengalihan antrean. Sebaiknya backend validasi koordnat, dan buat titik dari mitra minta persetujuan admin dulu sebelum tampil ke publik.
- Pengalihan antrean (85 persen atau lebih) saat ini dihitung di frontend dan di server contoh. Idealnya disatuin di sevrer.


BAGIAN 7 - Endpoint yg BELUM ada (jujur makany baca smpe akhir)

Soal "kenapa gak sekalian dilengkpin": dulu gw cuma nulis daftar kekurangannya karena UI belum manggil endpoint2 ini, jadi di bawah udh gw tulis kontrak lengkapnya.

PENTING: ini KONTRAK USULAN. UI udh manggil sebagian (B, C, dan empat endpoint akun di D: forgot-password, reset-password, change-password, DELETE /api/me), server contoh di src/app/api juga udh ngikutin. Yg belum dipake UI: A (profil), verify-email dan resend-verification, daftar admin berpaginasi, dan sisanya yg ditandai di bawah. Tipenya udh gw tambahin di src/types/api.ts (cari tulisan "KONTRAK USULAN" di bagian bawah), jadi backend TS bisa langsng import. Kalo ada yg mau diubah, ubah di tipe itu dlu trus kabarin gw. Tiap endpoint ada baris "frontend:" yg bilang apa yg masih harus gw kerjan di UI. Jgn ngubah perilaku endpoint yg udh ada (bagian 4) tanpa kabarin gw dulu.

A. Profil dan XP wisatawan

- GET /api/me/profile
  - siapa: yg udah login (VISITOR, MERCHANT, ADMIN)
  - response: xp, level, checkedInSpotIds (array id spot), loreCards (array UnlockedLoreCard), vouchers (punya dia), reservations (punya dia)
  - level = floor(xp / 150) + 1, rumus yg dipake UI sekarang
  - XP user yg login dicatat SERVER: check-in (+50), reservasi (+75), scan objek (awardedPoints), dan verifikasi kehadiran dari mitra (awardedPoints masuk ke wisatawan yg check-in, makanya data check-in harus nyimpen userId). Voucer dan kartu lore dari scan juga disimpen ke akun dia.
  - tamu (gak login) tetep lokal di browser, gak ada endpoint buat mereka
  - error: 401 UNAUTHENTICATED
  - frontend: UDH BERES. Abis login (dan abis tiap check-in, reservasi, atau scan) UI manggil endpoint ini dan NGGANTI XP, level, kartu lore, titik yg udh check-in, tas, dan tiket dgn data server. Buat MERCHANT dan ADMIN, voucer dan tiket dari profil gak dipake buat tas (snapshot-nya itu punya lapak), cuma XP, kartu lore, dan check-in. Tamu tetep lokal. Server contoh ngikutin aturan XP di atas, termasuk XP verifikasi mitra yg masuk ke wisatawan yg check-in (kalo dia login). Bug lama yg ikut kebenahin: XP check-in sempat ke-tambah dua kali di klien.

B. Edit dan hapus titik

- PATCH /api/spots/{id}
  - siapa: MERCHANT (lapak sendiri), ADMIN
  - request: cuma field yg mau diubah. Semua peran: name, address, facilities, coordinates, quota.maxCapacity, quest.riddleTitle, quest.riddleClue, quest.loreNarrative, quest.targetObjectPrompt. Cuma ADMIN: spotType, opkCategory, vibe, regionName, quest.verifiedLoreSource, quest.rewardPoints (dari mitra diabaikan)
  - response: spot dan spots
  - validasi sama kayak ADD_SPOT. Kalo mitra ngubah nama atau coordinates, status titik balik ke PENDING_REVIEW (kalo fitur review di bagian C dipake)
  - error: 400 input salah, 403 NOT_YOUR_SPOT, 404
  - frontend: UDH BERES. Tombol Ubah di tab Lapak dan Misi buka sheet edit (nama, lokasi di peta, alamat, petunjuk misi, cerita, fasilitas, kapasitas). Server contoh ngikutin aturan status di atas.

- DELETE /api/spots/{id}
  - siapa: MERCHANT (lapak sendiri), ADMIN
  - response: spots
  - saranan: soft delete (status ARCHIVED). Titik ilang dari GET /api/spots, tapi voucer ACTIVE dan E-Ticket yg udh terbit tetep valid sampe kadaluarsa
  - error: 403 NOT_YOUR_SPOT, 404
  - frontend: UDH BERES. Tombol Arsipkan lapak di sheet edit, pake konfirmasi 2 langkah. Server contoh nyaring titik ARCHIVED dari GET /api/spots.

C. Persetujuan mitra dan review titik

- field baru (opsional di tipe): AuthUser.status (cuma buat MERCHANT: PENDING, ACTIVE, REJECTED) dan CulturalSpot.status (PENDING_REVIEW, PUBLISHED, REJECTED, ARCHIVED). Kalo kosong dianggap ACTIVE dan PUBLISHED, jadi data lama aman.
- aturan: register MERCHANT bikin status PENDING. Mitra PENDING boleh login tapi aksi nuils (ADD_SPOT, UPDATE_PROMO, redeem, verifikasi kehadiran) ditolak 403 ACCOUNT_NOT_APPROVED. Titik dari mitra mulai PENDING_REVIEW, titik dari admin langsung PUBLISHED, tpi itu usulan. GET /api/spots buat publik cuma PUBLISHED, sedangkan pemilik dan admin juga liat titik PENDING_REVIEW atau REJECTED miliknya.

- GET /api/admin/merchants?status=&limit=&cursor=
  - siapa: ADMIN
  - response: merchants (tiap item: id, name, email, status, createdAt, spotCount) dan nextCursor?

- POST /api/admin/merchants/{id}/approve
  - siapa: ADMIN, body kosong
  - response: merchant
  - error: 404, 409 kalo udh ACTIVE

- POST /api/admin/merchants/{id}/reject
  - siapa: ADMIN
  - request: reason?
  - response: merchant
  - error: 404, 409 kalo udh diputusin

- POST /api/admin/spots/{id}/review
  - siapa: ADMIN
  - request: decision (PUBLISH atau REJECT), reason?
  - response: spot dan spots
  - error: 404, 409 kalo udh diputusin
  - frontend: UDH BERES. Dasbor mitra nampilin banner nunggu persetujuan (tombol Periksa status manggil /api/auth/me) dan nonaktifin tambah/ubah lapak. Dasbor admin punya tab Persetujuan buat mitra dan titik yg nunggu. Server contoh ngirim kode ACCOUNT_NOT_APPROVED. Alasan penolakan (opsional, maks 200 karakter) udh ada kolom isiannya di dasbor admin, disimpan di field statusReason (AuthUser dan CulturalSpot, tipe udh ditambahin) dan ditampilin ke mitra di banner dan kartu lapak. Pas disetujui atau diterbitkan, statusReason dikosongin.

D. Akun

- POST /api/auth/verify-email
  - request: token, response: ok true, error: 400 TOKEN_INVALID_OR_EXPIRED
- POST /api/auth/resend-verification
  - siapa: yg udah login, response: ok true, error: 429 RATE_LIMITED
- POST /api/auth/forgot-password
  - request: email
  - response SELALU ok true (jgn bocorin email itu terdaftar atau enggak)
- POST /api/auth/reset-password
  - request: token, password (minimal 8 karakter)
  - response: ok true, error: 400 TOKEN_INVALID_OR_EXPIRED
- POST /api/auth/change-password
  - siapa: yg udah login
  - request: currentPassword, newPassword (minimal 8 karakter)
  - response: ok true, error: 401 BAD_CREDENTIALS kalo sandi lama salah
- DELETE /api/me
  - siapa: yg udah login
  - request: password (konfirmasi)
  - response: ok true
  - hapus akun plus data lokasi dan check-in yg nyambung ke dia (kebutuhan UU PDP). Voucer dan titik milik mitra diarsipin atau dianonimin, jgn dihapus mentah
- frontend: lupa sandi (halaman /lupa-sandi, tautan email harus ngarah ke /lupa-sandi?token=...), ganti sandi, dan hapus akun UDH BERES di sheet Akun. Verifikasi email belum ada UI-nya. Ada 2 hal di server contoh yg JANGAN ditiru backend asli: (1) forgot-password di mode demo ngebalikin demoToken biar alurnya bisa dicoba tanpa email, backend asli harus SELALU cuma ok true dan kirim tautan lewat email; (2) akun demo bawaan ditolak buat ganti sandi dan hapus (DEMO_ACCOUNT_LOCKED) biar akun publik gak dikunci orang iseng. Soal change-password, server contoh juga balikin token baru (sesi lama dicabut), UI nerima token itu kalo ada, kalo backend pake cookie ya gak perlu.

E. Upload gambar buat scanner

- POST /api/ai/lens-verify versi upload (alamat sama, tapi Content-Type multipart/form-data)
  - request: field spotId (teks) dan image (file jpeg, png, atau webp, maksimal 5 MB)
  - versi JSON yg sekarang (sampleId) tetep dipake buat mode demo
  - response: LensVerificationResult. Kalo objek GAK dikenali: tetep status 200, isVerified false, confidenceScore kecil, ada message (alasan buat user), dan TANPA issuedVoucher
  - error: 400 kalo gak ada file, 413 IMAGE_TOO_LARGE, 415 IMAGE_TYPE_UNSUPPORTED
  - anti-spam: sekarang tiap scan nerbitin voucer baru tanpa batas. Di produksi batasin satu voucer per pengunjung per titik per hari (tamu: per perangkat)
  - frontend: UDH BERES. Scanner ngirim foto beneran (kamera atau unggahan) sbg multipart, dikecilin dulu ke sisi terpanjang 1280 px jadi JPEG (file field namanya image). Kalo isVerified false, UI nampilin message dan GAK ngasih kartu, voucer, atau XP. Mode sampel (JSON sampleId) cuma muncul pas mode demo. Server contoh nganggep foto di bawah 8 KB sbg objek gak dikenali, itu cuma akal2an demo, bukan logika AI.

F. Geofence check-in

- POST /api/checkins (yg udh ada) diperluas
  - request tambahan (opsional di tipe): lat, lng, accuracyMeters
  - kalo geofence nyala di server: lat dan lng wajib (400 LOCATION_REQUIRED). Jarak dihitung Haversine ke coordinates titik. Kalo lebih dari radius (usul 100 meter, atur di server) balikin 403 OUT_OF_RANGE dgn details distanceMeters. accuracyMeters di atas 100 ditolak 400 LOCATION_TOO_INACCURATE
  - anti-spam: satu check-in per pengunjung per titik per hari
  - geofence harus bisa dimatiin lewat env biar demo juri aman
  - jgn nyimpen koordinat mentah lebih lama dari perlu (UU PDP)
  - kode galat tambahan yg udh dipake UI: 409 ALREADY_CHECKED_IN_TODAY, dan 403 IMPOSSIBLE_TRAVEL (check-in ke titik lain dalam 10 menit terakhir dgn kecepatan antar-titik mustahil, server contoh batasnya 40 m/detik). Di OUT_OF_RANGE, details sebaiknya ngirim distanceMeters DAN radiusMeters, UI nampilin dua2nya.
  - env server contoh: GEOFENCE_ENABLED=true buat nyalain (default mati), GEOFENCE_RADIUS_METERS buat radius (default 100)
  - penting soal "gak bisa dibohongin": GPS dari browser BISA dipalsuin (aplikasi lokasi palsu, devtools). Frontend gak bisa nyegah itu. Pertahanan yg beneran ada di server: radius plus batas akurasi, satu check-in per titik per hari, cek kecepatan mustahil antar titik, rate limit per akun dan per IP, dan yg paling kuat kode kehadiran yg dicek langsung sama mitra di lapak (udh ada). Scan objek foto juga jadi bukti kedua. Jangan pernah percaya hasil jarak yg dihitung di klien, server selalu ngitung ulang.
  - frontend: UDH BERES. Check-in nyoba dulu tanpa lokasi, kalo server bales 400 LOCATION_REQUIRED baru UI minta persetujuan lokasi (sheet persetujuan LOKAWIRA sendiri sebelum izin peramban), baca lokasi SEKALI, lalu ngulang dgn lat, lng, accuracyMeters. Jadi pas geofence mati (demo juri) gak ada pop-up sama sekali. Ada juga pemandu arah di kartu titik (jarak, panah, link rute Google Maps) dan titik Kamu dari GPS asli di peta. Posisi pas dipandu cuma dipake di perangkat, gak dikirim ke server. Izin bisa dicabut di sheet Akun. Teks persetujuan masih DRAF (ada penanda di mode demo), perlu diganti kebijakan privasi resmi, dan janji di teks itu (koordinat mentah gak disimpen lebih lama dari perlu) HARUS ditepati backend.

G. Isi snapshot per peran dan pagination

- GET /api/spots sekarang gabungan 4 hal. Versi produksi:
  - spots: yg PUBLISHED (plus milik sendiri buat pemilik dan admin)
  - aiTrainingNotes: cuma ADMIN, selain itu array kosong
  - vouchers dan reservations: ADMIN dikasih lewat endpoint H (di snapshot kosong), MERCHANT voucer lapaknya, wisatawan login miliknya sendiri, tamu array kosong
  - query tambahan: limit dan cursor. Response tambahan: nextCursor?
- frontend: UDH BERES. Provider sekarang GABUNGIN snapshot ke tas tamu (item dari server menang kalo kodenya sama, sisanya tetep disimpen), jadi backend boleh ngosongin vouchers dan reservations buat tamu tanpa ngehapus tas mereka. Buat user yg login, server tetep sumber kebenaran, dan tas dikosongin pas ganti akun atau logout (biar data akun sebelumnya gak kebawa di perangkat bareng). Server contoh masih ngembaliin semua voucer ke tamu, itu cuma buat demo.

H. Daftar buat admin (dipaginasi)

- GET /api/admin/reservations?spotId=&status=&from=&to=&limit=&cursor=
  - siapa: ADMIN, response: reservations dan nextCursor?
- GET /api/admin/vouchers?spotId=&status=&limit=&cursor=
  - siapa: ADMIN, response: vouchers dan nextCursor?
- frontend: UDH BERES. Dasbor admin (tab E-Ticket dan tab Voucer) manggil dua endpoint ini, 10 item per halaman, tombol Muat lebih banyak (pake nextCursor), dan filter status. Cursor harus dianggap buram oleh klien. Catatan: halaman /merchant-pos buat ADMIN (tampilan semua lapak) masih baca vouchers dari snapshot, jadi snapshot ADMIN jangan dikosongin dulu sampe gw pindahin itu juga.

I. Waktu pake ISO 8601

- field yg harus jadi ISO 8601 UTC: expiresAt (atau null kalo gak kadaluarsa), redeemedAt, createdAt reservasi, unlockedAt, updatedAt catatan AI. scheduledSlot dan nextAvailableSlot tetep teks tampilan (mis "14:30 WIB") sampe ada jadwal beneran.
- frontend: UDH BERES. UI sekarang ngerti dua bentuk: ISO 8601 (ditampilin pake zona WIB, mis "2 Nov 2026, 17.30 WIB") dan teks lama. expiresAt boleh null (tampil "Tanpa batas waktu"). Jadi backend boleh langsung ngirim ISO, gak perlu nunggu gw.

J. Health check

- GET /api/health
  - siapa: siapa aja, tanpa login
  - response: ok true, version, time (ISO)
  - buat monitoring di VPS

Catatan desain: POST /api/spots dipake buat 4 aksi lewat field action. Karena backend nya TS/Node itu bisa langsung ditiru apa adanya, dan endpoint baru di atas (PATCH dan DELETE /api/spots/{id}) gayanya REST. Kalo mau semuanya REST: UPDATE_QUOTA jadi PATCH /spots/{id}/quota, UPDATE_PROMO jadi PUT /spots/{id}/promo, ADD_SPOT jadi POST /spots, ADD_AI_NOTE jadi POST /ai-notes. Bilang aja, yg diubah di frontend cuma satu file yaitu src/lib/api.ts.

Yg udah diperagain server contoh tapi cuma di memori (ilang kalo restart): login pake scrypt, sesi token, batas percobaan login, peran, kepemilikan lapak, check-in dan verifikasi kehadiran, redeem yg ngehormatin kepemilikan.

Yg masih harus dikerjain backend di luar daftar endpoint:
- Database, termasuk user dan sesi yg bisa kadaluarsa. Server contoh gak bisa jalan di serverless.
- Penerbitan voucer: kode sekarang acak tanpa jaminan unik, signatureHash cuma hiasan, dan bonus pengalihan antrean pake angka tetap 15000. Butuh kode unik, tanda tangan beneran, dan aturan nilai di server.
- Kuota beneran. UPDATE_QUOTA itu input manual admin.
- Keamanan dasar: validasi input menyeluruh, rate limit di redeem, reservations, lens-verify, register, HTTPS (kamera scanner cuma jalan di konteks aman), dan audit log penebusan.


BAGIAN 8 - Status di sisi frontend

Udah ada:
- klien API terpusat (timeout, error terstruktur, dukungan token)
- AuthProvider dan RequireRole, halaman /masuk, sheet akun
- saklar NEXT_PUBLIC_DEMO_MODE yg aman by default (di produksi mati kecuali diisi true)
- penanda "Offline" di peta, dan pesan sukses yg jujur (gak ngaku "tersimpan" kalo server nolak)
- header keamanan dasar, viewport-fit=cover, halaman error dan not-found, ESLint

Belum ada (aset):
- logo dan favicon (browser bakal minta /favicon.ico dan dapet 404)
- kebijakan privasi dan persetujuan data lokasi yg beneran (pdpConsentAccepted sekarang cuma status lokal)
- posisi user beneran (jarak di pencarian dihitung dari jangkar kawasan)
- font diambil dari Google Fonts pas build, jadi build butuh internet (atau pindahin ke next/font/local)


BAGIAN 9 - Cek sebelum produksi

- NEXT_PUBLIC_API_BASE_URL udah diisi, dan NEXT_PUBLIC_DEMO_MODE kosong
- CORS dan sesi (token atau cookie) udah dites dari domain Vercel ke VPS
- semua endpoint di bagian 4 balikin JSON persis sama kayak src/types/api.ts
- aturan peran di bagian 3 ditegakin di server, bukan cuma di UI
- bagian 7 diberesin (minimal: database, profil XP, persetujuan mitra, redeem atomik)
- logika AI storyteller udh dipindahin ke backend. Habis itu (dan setelah demo juri kelar) src/app/api/*, src/lib/server/, dan src/lib/nineRouterClient.ts boleh dihapus. .env.local gak boleh ke-commit
- npm run lint, npm run build, dan klik-klik tes di HP beneran
- logo, favicon, dan kebijakan privasi udah disiapin


BAGIAN 10 - Catatan tmbahan klo jdi make ts/nodejs

- Share tipe: copy src/types/lokawira.ts dan src/types/api.ts ke backend (atau taruh di package bareng kalo monorepo) biar frontend dan backend compile ke kontrak yg sama. Ingat tipe TS gak ngevalidasi pas runtime, jadi bikin skema validasi (mis pake zod) yg ngikutin tipe itu buat nolak input salah.
- Kode contoh bisa dipake ulang: src/lib/server/mockBackend.ts udh TS dan Node. Hash sandi pake scrypt (node:crypto), token sesi, penjaga peran (requireRole), cek kepemilikan (ownsSpot), dan batas percobaan login semuanya bisa dipindah hampir apa adanya. Yg beda cuma penyimpanannya: ganti Map di memori jadi database, dan ganti tipe NextRequest jadi request milik framework yg dipake.
- Framework bebas (Express, Fastify, NestJS, Hono semuanya bsia). Yg penting: CORS sesuai bagian 1, body JSON, dan format error bagian 2.
- Redeem harus atomik di level database. Di SQL: UPDATE vouchers SET status = 'REDEEMED', redeemed_at = now() WHERE code = $1 AND status = 'ACTIVE' RETURNING *. Kalo gak ada baris yg kena, baru cek kenapa (404 gak ada, 409 udh ditebus, 403 bukan lapaknya). Di MongoDB pake findOneAndUpdate dgn filter status ACTIVE. Jgn baca dulu baru nulis, nanti bisa ketebus dua kali (race condtion).
- Kode unik voucer (LKW-) dan kode kehadiran (KDR-): bikin pake crypto.randomInt, trus kasih unique index di database dan ulangi kalo tabrakan.
- Uang pake bilangan bulat rupiah, waktu pake ISO 8601 UTC, id pake string.
- Opsi lain: karena sama2 TS, endpoint bisa ditaruh di Next.js (route handler) di project yg sama dan gak butuh CORS. Tapi alur teknis nentuin backend di VPS, dan di Vercel serverless gak bisa nyimpen state di memori, jadi tetep butuh database dan batasan jalannya beda. Pilih salah satu jgn dua2nya.

K. Tes otomatis (QA)

- folder tests/e2e plus playwright.config.ts: 21 tes (aksesibilitas axe di 360 dan 390 px, alur login per peran, persetujuan mitra dan review titik, akun, profil/XP server, daftar admin berpaginasi, geofence, scanner)
- jalanin: npm run test:e2e. Itu otomatis build (dgn NEXT_PUBLIC_DEMO_MODE=true) lalu start di port 3210 dgn geofence nyala. Hentikan npm run dev dulu karena build nulis ke folder .next yg sama
- browser: pake chromium dari Playwright 1.58.0. Kalo belum ada: npx playwright install chromium
- tes ke server lain (mis staging): QA_URL=https://alamat npm run test:e2e. Server itu harus mode demo dan geofence nyala, kalo gak tes geofence bakal gagal
- font Figtree dan Fraunces sekarang ditanam di src/app/fonts (lisensi OFL), jadi build gak lagi butuh akses ke Google Fonts
