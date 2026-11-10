# Panduan Deploy Backend LOKAWIRA (100% Gratis)

Panduan ini menjelaskan cara mempublikasikan Backend Fastify + PostgreSQL LOKAWIRA menggunakan opsi hosting gratis terbaik dengan latensi terendah untuk pengguna di Indonesia.

---

## 1. Database: Neon.tech (PostgreSQL Serverless)

[Neon.tech](https://neon.tech/) menyediakan PostgreSQL serverless gratis selamanya dengan performa tinggi dan dukungan region Singapura.

### Langkah Setup Neon:
1. Buka [neon.tech](https://neon.tech/) dan daftar akun gratis (bisa login via GitHub).
2. Buat Project baru:
   - **Name**: `lokawira-db`
   - **Region**: `Asia Pacific (Singapore) - ap-southeast-1` (sangat penting agar latensi rendah).
   - **Postgres version**: 16 (default).
3. Setelah database terbuat, pada dashboard Neon salin **Connection string**:
   ```text
   postgresql://lokawira_owner:PASSWORD@ep-xyz.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```
4. Simpan connection string ini untuk dimasukkan ke variabel environment backend nanti.

> [!NOTE]
> Skema tabel dan data awal (seed) akan otomatis dibuat oleh backend saat pertama kali dijalankan via `migrate()` dan `seed()` di `server.ts`.

---

## 2. Web Service: Render.com (Paling Populer & Mudah)

[Render.com](https://render.com/) menyediakan Free Web Service untuk Node.js dengan deploy otomatis setiap kali kamu melakukan git push.

### Langkah Setup Render:
1. Buka [render.com](https://render.com/) dan login menggunakan akun GitHub kamu.
2. Klik **New +** > **Web Service**.
3. Pilih repositori GitHub: `Stevyussz/LOKAWIRA`.
4. Isi konfigurasi berikut:
   - **Name**: `lokawira-backend` (atau nama pilihanmu)
   - **Region**: `Singapore (Southeast Asia)`
   - **Branch**: `main`
   - **Root Directory**: *(kosongkan)*
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm run backend:start`
   - **Instance Type**: `Free`
5. Gulir ke bagian **Environment Variables** dan tambahkan variabel berikut:

| Key | Value Contoh | Keterangan |
| --- | --- | --- |
| `DATABASE_URL` | `postgresql://...@ep-xyz...neon.tech/neondb?sslmode=require` | Connection string dari Neon |
| `DATABASE_SSL` | `true` | Wajib untuk Neon |
| `SESSION_SECRET` | *(string acak minimal 32 karakter)* | Buat misal dari: `openssl rand -base64 48` |
| `ADMIN_NAME` | `Pengelola LOKAWIRA` | Nama admin utama |
| `ADMIN_EMAIL` | `admin@lokawira.id` | Email login admin |
| `ADMIN_PASSWORD` | `SandiKuatMinimal10Karakter!` | Sandi login admin |
| `CORS_ORIGINS` | `https://lokawira.vercel.app` | URL domain frontend kamu (tanpa slash akhir) |
| `TRUST_PROXY` | `10.0.0.0/8,172.16.0.0/12,192.168.0.0/16` | Agar IP asli terbaca di balik reverse proxy |
| `DEMO_ACCOUNTS` | `false` | Set `true` hanya jika butuh akun kurasi demo untuk juri |
| `LOG_LEVEL` | `info` | Level log server |

6. Buka **Advanced**:
   - **Health Check Path**: `/api/health`
7. Klik **Deploy Web Service**.
8. Tunggu hingga build selesai dan status menjadi **Live**. URL backend kamu akan berupa: `https://lokawira-backend.onrender.com`.

> [!TIP]
> Paket gratis Render akan tidur (*spin-down*) jika tidak ada traffic selama 15 menit. Request pertama setelah tidur membutuhkan waktu ~30 detik untuk bangun (*cold-start*). Jika ingin selalu terjaga, kamu bisa menggunakan cron job gratis seperti [cron-job.org](https://cron-job.org) atau [UptimeRobot](https://uptimerobot.com) untuk melakukan ping ke `https://lokawira-backend.onrender.com/api/health` setiap 10-14 menit.

---

## 3. Alternatif Web Service: Koyeb (Eco Service)

Jika ingin alternatif tanpa batas spin-down Render:
1. Buka [koyeb.com](https://www.koyeb.com/).
2. Buat App baru > **GitHub**.
3. Pilih repo `Stevyussz/LOKAWIRA`, branch `main`.
4. Pilih **Dockerfile** (otomatis mendeteksi `backend/Dockerfile`) atau **Node.js Buildpack**.
5. Masukkan Environment Variables sama seperti daftar di atas.
6. Port: `4000`.

---

## 4. Hubungkan Frontend ke Backend Baru

Setelah backend live di Render atau Koyeb:
1. Buka dashboard hosting frontend (misal **Vercel**).
2. Di **Settings** > **Environment Variables**:
   - `NEXT_PUBLIC_API_BASE_URL`: `https://lokawira-backend.onrender.com`
   - `NEXT_PUBLIC_DEMO_MODE`: `false`
3. Lakukan **Redeploy** frontend di Vercel.
4. Sekarang frontend Next.js kamu sudah terhubung sepenuhnya ke backend Fastify dan database Neon PostgreSQL!
