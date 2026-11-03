
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
- Reservasi, scan objek, tanya Loka, check-in: semua boleh
- Tebus voucer (redeem): mitra cuma buat voucer lapaknya sendiri, admin semua. Tamu dan wisatawan gak boleh.
- Tambah titik (POST /api/spots): mitra boleh, ownerId diisi id dia sendiri, dan gak boleh bikin jenis PRIMARY_DEST. Admin boleh semua jenis. Tamu dan wisatawan gak boleh.
- Atur promo (PUT /api/spots/{id}/promo): mitra cuma lapaknya sendiri, admin semua dan cuma admin yg boleh ngubah rewardPoints.
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

- PATCH /api/spots/{id}/quota
  - siapa: ADMIN
  - request: currentVisitors (id titik ada di path)
  - response: spot dan spots
  - server ngejepit currentVisitors di antara 0 sampai maxCapacity, dan ngitung estimatedWaitMinutes (rasio 85 persen atau lebih = 35 menit, 60 persen atau lebih = 15, sisanya 0)

- POST /api/spots
  - siapa: MERCHANT, ADMIN
  - request: body-nya langsung objek CulturalSpot (lihat bagian entitas), gak dibungkus apa2
  - response: spot dan spots, status 201
  - server yg bikin id, createdAt (ISO), dan ownerId. Id yg dikirim frontend (isinya "draft") diabaikan.
  - validasi: name gak boleh kosong, coordinates.lat dan lng harus angka, quest.targetObjectPrompt gak boleh kosong (objek yg dipotret wisatawan), quest.voucherReward.discountAmount 1000 sampai 100000 dan minimumSpend 0 sampai 10000000. Mitra dilarang bikin PRIMARY_DEST (403 FORBIDDEN). quest.referenceImages dari klien diabaikan, foto cuma lewat endpoint reference-images di bawah.

- PUT /api/spots/{id}/promo
  - siapa: MERCHANT (lapak sendiri), ADMIN
  - request: discountTitle, discountAmount, minimumSpend, rewardPoints? (id titik ada di path)
  - response: spot dan spots
  - validasi: discountTitle wajib, discountAmount antara 1000 sampai 100000, minimumSpend 0 atau lebih, rewardPoints cuma dipake kalo yg ngirim ADMIN (0 sampai 1000), buat mitra diabaikan
  - error: 403 NOT_YOUR_SPOT kalo bukan lapaknya

- POST /api/ai-notes
  - siapa: ADMIN
  - request: opkCategory, maestroSource, summary
  - response: aiTrainingNotes (daftar lengkap terbaru), status 201

- PATCH /api/ai-notes/{id}
  - siapa: ADMIN
  - request: opkCategory?, maestroSource?, summary? (kirim yg diubah aja)
  - validasi: maestroSource minimal 5 huruf, summary minimal 20 huruf
  - response: aiTrainingNotes (daftar lengkap terbaru). 404 kalo id gak ada

- DELETE /api/ai-notes/{id}
  - siapa: ADMIN
  - response: aiTrainingNotes (daftar lengkap terbaru). 404 kalo id gak ada. UI minta konfirmasi dulu sebelum manggil ini

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
  - request: spotId, dan lat, lng, accuracyMeters? (wajib kalo server nyalain geofence, detail di bagian 7 huruf F)
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
  - request: sampleId, spotId, customImageName?, lat?, lng?, accuracyMeters?
  - response: LensVerificationResult (lihat entitas), isi issuedVoucher kalo dapet voucer
  - lat, lng, accuracyMeters WAJIB kalo geofence nyala (sama persis kayak check-in, lihat bagian F). Kodenya sama: 400 LOCATION_REQUIRED, 400 LOCATION_TOO_INACCURATE, 403 OUT_OF_RANGE (details: distanceMeters dan radiusMeters). Geofence mati = lat dan lng diabaikan
  - catatan: UI sekarang ngirim FOTO ASLI sbg multipart (field spotId dan image), bukan lagi sampleId. Bentuk JSON di atas tetep diterima buat mode demo. Detail dan kode galatnya di bagian 7 huruf E. Logika AI nya ngebandingin foto dgn quest.targetObjectPrompt dan quest.referenceImages (foto contoh dr mitra)

- POST /api/ai/storyteller
  - siapa: semua
  - request: spotId, customQuestion?
  - response: spotId, spotName, opkCategory, verifiedSource, riddleTitle, isVerified, sourceMode, story, riddle
  - PENTING: logika AI nya (prompt, fallback pas gak ada API key, timeout 3,5 detik ke 9router) cuma ada di src/app/api/ai/storyteller/route.ts dan src/lib/nineRouterClient.ts. Backend harus bikin ulang, jadi jgn hapus dua file itu sebelum logikanya dipindahin.


Tambahan: endpoint yg UI SUDAH manggil (versi lengkap tiap endpoint ada di bagian 7, ini daftar ringkasnya biar semua endpoint ada di satu tempat)

Akun dan profil (bagian 7 huruf A dan D)

- GET /api/me/profile
  - siapa: yg login (wisatawan)
  - response: xp, level, checkedInSpotIds, loreCards, vouchers, reservations. XP dan level milik server, klien cuma nampilin
- POST /api/auth/forgot-password: request email, response ok true. Jangan bocorin apakah email terdaftar. Jangan balikin token di response (server contoh cuma ngelakuin itu di mode demo)
- POST /api/auth/reset-password: request token dan password (min 8)
- POST /api/auth/change-password: request currentPassword dan newPassword. Sesi lain dicabut
- DELETE /api/me: request password. Hapus akun

Titik dan foto contoh (bagian 7 huruf B)

- PATCH /api/spots/{id}
  - siapa: MERCHANT (lapak sendiri), ADMIN
  - request: field yg mau diubah aja (name, address, facilities, coordinates, quota.maxCapacity, quest.*). Field sensitif (spotType, opkCategory, vibe, regionName, quest.verifiedLoreSource, quest.rewardPoints) cuma diterima dari ADMIN
  - response: spot dan spots. Mitra ngubah nama atau lokasi = status balik PENDING_REVIEW
- DELETE /api/spots/{id}: soft delete (ARCHIVED), response spots
- POST /api/spots/{id}/reference-images
  - siapa: MERCHANT (lapak sendiri, akun harus ACTIVE), ADMIN
  - request: multipart, field image (JPEG, PNG, atau WebP, maks 5 MB)
  - response: referenceImages (array id dan url). Maks 5 foto per lapak
  - error: 413 IMAGE_TOO_LARGE, 415 IMAGE_TYPE_UNSUPPORTED, 409 TOO_MANY_IMAGES, 403 NOT_YOUR_SPOT
- DELETE /api/spots/{id}/reference-images/{imageId}: response referenceImages terbaru
- GET /api/spots/{id}/reference-images/{imageId}: balikin file gambarnya (publik, dipake tag img)

Pengelola (bagian 7 huruf C dan H)

- GET /api/admin/merchants?status=: daftar mitra (id, name, email, status, createdAt, spotCount)
- POST /api/admin/merchants/{id}/approve dan /reject (reject boleh kirim reason). Dipake juga buat nonaktifin dan aktifin lagi mitra
- POST /api/admin/spots/{id}/review: request decision (PUBLISH atau REJECT) dan reason?
- GET /api/admin/reservations dan GET /api/admin/vouchers: dipaginasi (limit, cursor, status). Response nextCursor kosong kalo habis

Health

- GET /api/health: ok, version, time, dan checkInRadiusMeters? (cuma diisi kalo geofence nyala, dipake UI buat nentuin "sudah tiba")

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

- Promo itu templat, BUKAN voucer. PUT /api/spots/{id}/promo ngubah spot.quest.voucherReward. Voucer baru cuma lahir dari lens-verify dan dari bonus reservations, pake templat itu. Endpoint lama vouchers/claim udah dihapus karena nerbitin voucer yg langsung nongol di tas wisatawan.
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
  - validasi sama kayak POST /api/spots. Kalo mitra ngubah nama atau coordinates, status titik balik ke PENDING_REVIEW (kalo fitur review di bagian C dipake)
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
- aturan: register MERCHANT bikin status PENDING. Mitra PENDING boleh login tapi aksi nuils (POST /api/spots, PUT promo, redeem, verifikasi kehadiran) ditolak 403 ACCOUNT_NOT_APPROVED. Titik dari mitra mulai PENDING_REVIEW, titik dari admin langsung PUBLISHED, tpi itu usulan. Mitra yg dinonaktifkan (REJECTED) atau belum ACTIVE: SEMUA lapaknya juga hilang dari GET /api/spots publik dan dari pemilihan UMKM mitra buat voucer pengalih antrean (pemilik dan admin tetap liat), dan muncul lagi otomatis pas mitranya diaktifkan. GET /api/spots buat publik cuma PUBLISHED, sedangkan pemilik dan admin juga liat titik PENDING_REVIEW atau REJECTED miliknya.

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
  - request: field spotId (teks) dan image (file jpeg, png, atau webp, maksimal 5 MB), plus field teks lat, lng, accuracyMeters (wajib kalo geofence nyala)
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
  - response: ok true, version, time (ISO), dan checkInRadiusMeters (opsional)
  - checkInRadiusMeters cuma diisi kalo server mewajibkan jarak buat check-in (geofence nyala). Frontend pake angka ini buat nentuin "sudah tiba" di kartu pandu
  - buat monitoring di VPS

Catatan desain: POST /api/spots yg dulu dipake buat 4 aksi lewat field action UDAH DIPECAH jadi REST (disetujui temen backend). Pemetaannya: UPDATE_QUOTA jadi PATCH /api/spots/{id}/quota, UPDATE_PROMO jadi PUT /api/spots/{id}/promo, ADD_SPOT jadi POST /api/spots (body langsung CulturalSpot), ADD_AI_NOTE jadi POST /api/ai-notes. Field action udah gak dipake sama sekali. Frontend dan server contoh udah ngikut, yg berubah di frontend cuma src/lib/api.ts.

Yg udah diperagain server contoh tapi cuma di memori (ilang kalo restart): login pake scrypt, sesi token, batas percobaan login, peran, kepemilikan lapak, check-in dan verifikasi kehadiran, redeem yg ngehormatin kepemilikan.

Yg masih harus dikerjain backend di luar daftar endpoint:
- Database, termasuk user dan sesi yg bisa kadaluarsa. Server contoh gak bisa jalan di serverless.
- Penerbitan voucer: kode sekarang acak tanpa jaminan unik, signatureHash cuma hiasan, dan bonus pengalihan antrean pake angka tetap 15000. Butuh kode unik, tanda tangan beneran, dan aturan nilai di server.
- Kuota beneran. PATCH /api/spots/{id}/quota itu input manual admin.
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

- folder tests/e2e plus playwright.config.ts: 38 tes (alur wisatawan, halaman masuk, dasbor pengelola, dasbor mitra, peta nyata, aksesibilitas axe di 360 dan 390 px, alur login per peran, persetujuan mitra dan review titik, akun, profil/XP server, daftar admin berpaginasi, geofence, scanner)
- jalanin: npm run test:e2e. Itu otomatis build (dgn NEXT_PUBLIC_DEMO_MODE=true) lalu start di port 3210 dgn geofence nyala. Hentikan npm run dev dulu karena build nulis ke folder .next yg sama
- browser: pake chromium dari Playwright 1.58.0. Kalo belum ada: npx playwright install chromium
- tes ke server lain (mis staging): QA_URL=https://alamat npm run test:e2e. Server itu harus mode demo dan geofence nyala, kalo gak tes geofence bakal gagal
- font Figtree dan Fraunces sekarang ditanam di src/app/fonts (lisensi OFL), jadi build gak lagi butuh akses ke Google Fonts

L. Peta (sudah nyata, bukan gambar dummy lagi)

- peta pake MapLibre GL dgn data OpenStreetMap, ubinnya dr OpenFreeMap (gratis, tanpa kunci API). Gaya dasarnya diwarnai ulang jadi lontar di src/lib/mapStyle.ts. Atribusi OpenStreetMap dan OpenMapTiles wajib tetep tampil (tombol i di kanan atas peta)
- ganti sumber ubin tanpa ubah kode: isi NEXT_PUBLIC_MAP_STYLE_URL (alamat style JSON MapLibre). Buat produksi ramean, sebaiknya host sendiri di VPS (Protomaps/PMTiles atau OpenFreeMap self-host) biar gak bergantung layanan publik
- rute jalan kaki ke titik tujuan diambil dr layanan routing berbasis OSM (routing.openstreetmap.de, cuma buat pemakaian ringan). Ganti lewat NEXT_PUBLIC_ROUTING_URL kalo backend nyediain OSRM atau Valhalla sendiri (format OSRM /route/v1/foot). Kalo layanannya gagal, peta nampilin garis putus lurus sbg cadangan
- penanda Kamu cuma muncul dr GPS asli. Gak ada lagi posisi simulasi
- koordinat titik di data (coordinates.lat dan lng) sekarang kelihatan di peta nyata, jadi harus akurat. Cek tiap titik di Google Maps atau OSM sebelum penjurian


M. Mode demo dimatiin (buat penjurian & integrasi)

- NEXT_PUBLIC_DEMO_MODE=false: tombol Demo lonjakan, sampel scanner, daftar akun demo, dan semua fallback lokal (check-in/kapasitas yg cuma di perangkat) ilang. Semua harus lewat server
- server contoh bawaan (src/app/api) tetep nyala sbg pengganti sementara kalo MOCK_BACKEND=true diisi (server-side). Isinya in-memory dan akun bawaan (wisatawan/mitra/admin @lokawira.demo, sandi demo1234) masih ada. Itu publik di repo, jadi JANGAN dipake di produksi sungguhan
- begitu backend asli siap: isi NEXT_PUBLIC_API_BASE_URL, hapus MOCK_BACKEND, selesai. Tanpa keduanya, API contoh bales 503 MOCK_DISABLED
- lupa sandi: server contoh gak bisa ngirim email dan gak lagi ngebalikin token saat mode demo mati, jadi alur ini baru jalan setelah backend asli punya pengirim email

N. Alur pandu (frontend)

- tombol Pandu aku ada di kartu lokasi. Tekan: minta izin lokasi, peta zoom out nunjukin rute penuh (posisi ke tujuan) + jarak & perkiraan menit jalan kaki. Tekan Mulai: kamera ngikutin posisi dan peta diputar sesuai arah hadap
- Check-In di kartu pandu terkunci sampai user dalam radius (checkInRadiusMeters dr /api/health, default 60 m kalo kosong). Server TETAP wajib ngecek jarak sendiri, tombol ini cuma UX
- kode kehadiran (KDR-) = bukti hadir. User nunjukin ke pemilik lapak, lapak ngetik di kasir (POST /api/checkins/verify), baru hadiah misi masuk ke akun user
- voucer di Tas: tombol Tunjukkan ke kasir nampilin kode besar. Penebusan tetap dilakukan kasir lewat POST /api/vouchers/redeem, user gak diarahin ke halaman kasir

O. Dasbor mitra (alur baru)

- tab sekarang tiga: Kasir, Lapak Saya, Promo & Scan. Verifikasi kehadiran pindah ke Kasir. Satu kotak kode: awalan LKW- dipanggil ke POST /api/vouchers/redeem, awalan KDR- ke POST /api/checkins/verify. Frontend yg milih endpoint dari awalan kodenya
- objek scan sekarang diisi mitra: quest.targetObjectPrompt (teks) plus foto contoh. Backend AI harus ngebandingin foto wisatawan dgn teks dan foto contoh itu. Foto wisatawan TIDAK diunggah ke lapak, dia cuma motret objek aslinya
- endpoint foto contoh (mitra pemilik lapak atau admin, akun mitra harus ACTIVE):
  - POST /api/spots/{id}/reference-images, multipart field image, JPEG/PNG/WebP maks 5 MB. Balikin referenceImages (array id dan url). Maks 5 foto per lapak, lewat itu 409 TOO_MANY_IMAGES
  - DELETE /api/spots/{id}/reference-images/{imageId}, balikin referenceImages terbaru
  - GET /api/spots/{id}/reference-images/{imageId} buat nampilin foto (publik)
  - di data titik: quest.referenceImages (opsional), array dgn id dan url. Url relatif ke API_BASE
- nominal voucer sekarang bebas diketik mitra. Batas yg dipake frontend dan server contoh: potongan Rp1.000 sampai Rp100.000, minimal belanja 0 sampai Rp10.000.000. Validasi ini berlaku di POST /api/spots maupun PUT promo (server contoh sekarang ngecek dua2nya). Server asli wajib validasi juga, jgn percaya frontend
- POST /api/spots sekarang wajib ngirim quest.targetObjectPrompt (gak boleh kosong). referenceImages dari klien diabaikan, foto cuma lewat endpoint di atas
- pemilih lokasi di form lapak: cari alamat lewat Nominatim OpenStreetMap (nominatim.openstreetmap.org, cuma buat pemakaian ringan, dipicu tombol Cari). Ganti lewat NEXT_PUBLIC_GEOCODE_URL kalo backend nyediain geocoder sendiri (format Nominatim /search). Tombol Pakai lokasiku sekarang pake izin lokasi yg sama dgn fitur pandu

P. Dasbor pengelola (alur baru)

- tab: Persetujuan (terbuka duluan, ada lencana jumlah), Titik di Peta, Kuota & Tiket, Hadiah & Voucer, Pengetahuan Loka. Kartu ringkasan di atas bisa diketuk. Istilah teknis (P0 sampai P4, RAG) sudah dibuang dari tampilan
- daftar semua mitra (aktif, menunggu, ditolak) pake GET /api/admin/merchants tanpa filter status. Nonaktifkan = POST /api/admin/merchants/{id}/reject dgn reason, aktifkan lagi = POST .../approve. Backend asli: mitra yg dinonaktifkan harus ditolak di semua endpoint tulis (ACCOUNT_NOT_APPROVED) dan sebaiknya lapaknya disembunyiin dari publik
- tombol simulasi Lengang 45 persen dan Padat 95 persen DIHAPUS. Gantinya pengelola ngisi angka jumlah pengunjung sekarang per titik (PATCH /api/spots/{id}/quota, 0 sampai maxCapacity). Backend asli sebaiknya ngitung ini otomatis dari check-in dan tiket, input manual cuma koreksi
- review titik dari mitra sekarang nampilin objek yg dipotret, voucer, dan foto contoh. Pengelola bisa ubah objek dan foto contoh titik mana pun (PATCH quest.targetObjectPrompt dan endpoint reference-images)
- check-in tiket cepat lewat nomor tiket: POST /api/reservations/checkin dgn ticketId
- nominal voucer dan XP misi diketik bebas. XP 0 sampai 1000, potongan Rp1.000 sampai Rp100.000
- kode tiket (ticketId) HARUS unik. Server contoh dulu cuma 3 digit acak dan bisa tabrakan, sekarang 6 digit dan dicek. Backend asli pake unique index

Q. Halaman masuk dan daftar

- satu halaman (/masuk) buat semua peran. Login gak nanya peran, backend yg nentuin dari akunnya (user.role), frontend ngarahin: ADMIN ke /admin, MERCHANT ke /merchant-pos, VISITOR ke peta
- daftar cuma nawarin Wisatawan (bawaan) dan Mitra. ADMIN gak bisa daftar sendiri, backend harus nolak role ADMIN di POST /api/auth/register (400 atau 403). Mitra baru statusnya PENDING sampe disetujui pengelola
- tautan ke pendaftaran mitra: /masuk?mode=daftar&role=mitra
- gambar latar belakang form: taruh file di folder public (mis. public/auth-bg.jpg) lalu isi NEXT_PUBLIC_AUTH_BG=/auth-bg.jpg di env. Kosong = latar lontar polos. Teks form ada di kartu solid jadi gambar apa pun tetep aman terbaca

R. Alur wisatawan (yg berubah)

- snapshot publik (GET /api/spots tanpa login) TIDAK boleh ngirim voucer atau tiket siapa pun: vouchers dan reservations kosong buat tamu. Tas tamu cuma ada di perangkatnya. Dulu server contoh ngebocorin semua voucer ke tamu. Admin dapat semua, mitra cuma voucer lapaknya, wisatawan login cuma miliknya
- respons POST /api/reservations buat tamu cuma isi reservation dan bonusVoucher yg barusan dibuat (bkn semua daftar)
- voucer pengalih antrean (bonusVoucher, kalo acceptCircularQuest true) sekarang milik UMKM MITRA TERDEKAT di kawasan yg sama, bkn milik cagar. spotId nya lapak mitra itu, nominal dan minimal belanja diambil dr promo lapak itu. Jadi mitra tsb yg bisa nebus di kasirnya. Kalo gak ada mitra di kawasan itu, bonusVoucher kosong
- scanner: wisatawan sekarang disuruh nyari objek dari quest.targetObjectPrompt, dan foto contoh (quest.referenceImages) ditampilin sbg petunjuk. Tombol Pindai terkunci sampe ada foto (kamera atau unggahan)
- scan SEKARANG ikut ngecek lokasi, sama persis kayak check-in (env geofence yg sama, kode galat yg sama). Frontend ngirim lat, lng, accuracyMeters di lens-verify. Alurnya: coba dulu tanpa lokasi, kalo server balas LOCATION_REQUIRED baru minta lokasi sekali (persetujuan dulu) lalu kirim ulang. Backend asli wajib ngitung jarak sendiri, jgn percaya klien
