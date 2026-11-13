# Deploy LOKAWIRA ke VPS

Panduan ini untuk satu VPS (RAM 4 GB, Ubuntu 22.04/24.04) yang menjalankan **backend Fastify, PostgreSQL, dan 9router**. Frontend tetap di **Vercel**. Bisa diikuti manusia atau agent dari atas ke bawah. Setiap bagian ditutup dengan perintah cek; jangan lanjut kalau ceknya gagal.

```
Browser ──HTTPS──► Vercel (Next.js, frontend)
   │
   └──HTTPS──► api.DOMAIN ─► Caddy :443 ─► backend :4000 (127.0.0.1)
                                              ├─► PostgreSQL :5432 (127.0.0.1)
                                              └─► 9router :20128 (127.0.0.1) ─► penyedia AI
```

Hanya port 22, 80, dan 443 yang terbuka ke internet. Postgres, backend, dan 9router cuma mendengar di `127.0.0.1`.

---

## 0. Aturan untuk yang menjalankan panduan ini

- **Rahasia tidak boleh dicetak, di-commit, atau ditempel ke chat/log.** Rahasianya: `SESSION_SECRET`, `ADMIN_PASSWORD`, sandi DB, `NINE_ROUTER_API_KEY`, sandi SMTP, dan isi folder `~/.9router`. Semuanya hanya ada di `/etc/lokawira/backend.env` (mode 600) dan di data 9router.
- **Jangan buka port 20128 (9router) atau 5432 (Postgres) ke publik.** Dasbor 9router berisi token akun AI. Buka hanya lewat SSH tunnel.
- **Jangan `git push` dari VPS.** VPS hanya `git pull` dari branch `main`.
- **Isi placeholder ini dulu sebelum mulai:**

| Placeholder | Arti | Contoh |
| --- | --- | --- |
| `DOMAIN` | domain milik tim | `lokawira.id` |
| `api.DOMAIN` | subdomain untuk backend | `api.lokawira.id` |
| `FRONTEND_ORIGIN` | alamat frontend, tanpa `/` di akhir. Boleh lebih dari satu, dipisah koma | `https://lokawira.id,https://www.lokawira.id,https://lokawira.vercel.app` |
| `VPS_IP` | IP publik VPS | `203.0.113.10` |

---

## 1. DNS

Di pengelola DNS domain:

1. Buat **A record**: `api` → `VPS_IP`. Kalau VPS punya IPv6, tambahkan juga **AAAA record**.
2. Kalau pakai **Cloudflare**, set record `api` ke **DNS only (awan abu-abu)**, bukan Proxied. Alasannya, mode proxy membuat semua pengunjung terbaca sebagai IP Cloudflare kecuali `TRUST_PROXY` diisi daftar IP Cloudflare. Selain itu, sertifikat Caddy juga lebih mudah terbit lewat DNS only.
3. Untuk frontend dengan domain sendiri: di Vercel buka **Settings → Domains → Add `DOMAIN`**, lalu ikuti record yang diminta Vercel (biasanya A `76.76.21.21` untuk apex dan CNAME `cname.vercel-dns.com` untuk `www`).

Cek, hasilnya harus `VPS_IP`:

```bash
dig +short api.DOMAIN
```

---

## 2. Dasar server (jalankan sebagai root, atau pakai sudo)

```bash
# 2.1 update dan paket dasar
apt update && apt -y upgrade
apt -y install git curl ufw fail2ban unattended-upgrades ca-certificates gnupg debian-keyring debian-archive-keyring apt-transport-https
dpkg-reconfigure -f noninteractive unattended-upgrades
timedatectl set-timezone Asia/Jakarta

# 2.2 swap 2 GB (supaya npm ci / lonjakan memori tidak kena OOM)
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
echo 'vm.swappiness=10' > /etc/sysctl.d/99-lokawira.conf && sysctl --system

# 2.3 firewall
ufw default deny incoming && ufw default allow outgoing
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp
ufw --force enable

# 2.4 batasi ukuran log journald
mkdir -p /etc/systemd/journald.conf.d
printf '[Journal]\nSystemMaxUse=500M\n' > /etc/systemd/journald.conf.d/size.conf
systemctl restart systemd-journald
```

**SSH:** login pakai SSH key, lalu matikan login dengan sandi. Set `PasswordAuthentication no` dan `PermitRootLogin prohibit-password` di `/etc/ssh/sshd_config`, lalu `systemctl reload ssh`. Pastikan dulu login dengan key **sudah berhasil** di terminal lain sebelum mematikan sandi, supaya tidak terkunci di luar server.

Cek:

```bash
ufw status
swapon --show
free -h
```

---

## 3. Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt -y install nodejs
node -v   # harus v20.x
```

---

## 4. PostgreSQL

```bash
apt -y install postgresql
systemctl enable --now postgresql

# buat user dan database. Ganti SANDI_DB dengan sandi acak, misalnya dari: openssl rand -hex 24
sudo -u postgres psql -v ON_ERROR_STOP=1 <<'SQL'
CREATE ROLE lokawira LOGIN PASSWORD 'SANDI_DB';
CREATE DATABASE lokawira OWNER lokawira;
SQL
```

Postgres di Ubuntu sudah cuma mendengar di `localhost` secara bawaan. Jangan ubah `listen_addresses`.

### Penyetelan untuk RAM 4 GB

Buat file `/etc/postgresql/*/main/conf.d/lokawira.conf`. Ganti `*` dengan versinya, misalnya `16`, dan buat folder `conf.d` kalau belum ada:

```ini
shared_buffers = 512MB
effective_cache_size = 1536MB
work_mem = 8MB
maintenance_work_mem = 128MB
max_connections = 40
wal_compression = on
random_page_cost = 1.1            # SSD/NVMe
log_min_duration_statement = 500  # catat query yang lebih lambat dari 0,5 detik
```

```bash
systemctl restart postgresql
```

Cek:

```bash
PGPASSWORD='SANDI_DB' psql -h 127.0.0.1 -U lokawira -d lokawira -c 'select 1'
```

---

## 5. Kode aplikasi

```bash
# user sistem tanpa login
useradd --system --create-home --home-dir /srv/lokawira --shell /usr/sbin/nologin lokawira

# repo privat: buat deploy key read-only di VPS, lalu tambahkan di GitHub → Settings → Deploy keys (tanpa write access)
sudo -u lokawira ssh-keygen -t ed25519 -N '' -f /srv/lokawira/.ssh/id_ed25519
cat /srv/lokawira/.ssh/id_ed25519.pub   # ini kunci PUBLIK, aman ditempel ke GitHub

sudo -u lokawira git clone --branch main git@github.com:Stevyussz/LOKAWIRA.git /srv/lokawira/app
cd /srv/lokawira/app
sudo -u lokawira npm ci          # install lengkap, supaya typecheck dan QA bisa jalan di server
sudo -u lokawira npm run backend:typecheck
```

`npm ci` dipakai lengkap, bukan `--omit=dev`, karena `typescript` dibutuhkan untuk typecheck dan butuh RAM saat instalasi. Swap dari langkah 2 mencegah OOM.

---

## 6. 9router (AI untuk Loka dan pindai objek)

```bash
npm install -g 9router
useradd --system --create-home --home-dir /var/lib/ninerouter --shell /usr/sbin/nologin ninerouter
```

Buat `/etc/systemd/system/ninerouter.service`:

```ini
[Unit]
Description=9router (AI gateway LOKAWIRA)
After=network-online.target
Wants=network-online.target

[Service]
User=ninerouter
WorkingDirectory=/var/lib/ninerouter
Environment=HOME=/var/lib/ninerouter
ExecStart=/usr/bin/9router --host 127.0.0.1 --port 20128 --no-browser --skip-update
Restart=always
RestartSec=5
MemoryMax=600M
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

Kalau `which 9router` bukan `/usr/bin/9router`, sesuaikan path di `ExecStart`.

```bash
systemctl daemon-reload && systemctl enable --now ninerouter
ss -ltnp | grep 20128     # harus 127.0.0.1:20128, BUKAN 0.0.0.0
```

### Login akun AI dan buat API key

1. Dari **laptop**, buka tunnel: `ssh -L 20128:127.0.0.1:20128 USER@VPS_IP`
2. Buka `http://localhost:20128` di browser laptop. Ini dasbor 9router di VPS.
3. Sambungkan akun penyedia AI yang dipakai tim, lalu pastikan model-model berikut muncul dan bisa dites:
   - Teks (Loka): `gemini/gemini-3.1-flash-lite-preview`, `ag/gemini-3.8-flash-low`, `gemini/gemini-3.5-flash-lite`
   - Gambar (pindai): `ag/gemini-3.8-flash-low`, `gemini/gemini-3.5-flash-lite`, `gemini/gemini-3.1-flash-lite-preview`

   Kalau ada yang tidak tersedia, ganti dengan model lain yang ada di dasbor. Untuk pindai, model **harus bisa membaca gambar**.
4. Buat **API key** di dasbor, lalu isi langsung ke `NINE_ROUTER_API_KEY` di langkah 7. Jangan disalin ke tempat lain.
5. Tutup tunnel.

Kalau 9router mati atau kuotanya habis, aplikasi **tetap jalan**: Loka menjawab dari data tercatat, dan pindai objek tidak memberi voucer. Ini memang disengaja supaya aman.

---

## 7. Konfigurasi backend

```bash
mkdir -p /etc/lokawira && touch /etc/lokawira/backend.env
chown root:lokawira /etc/lokawira/backend.env && chmod 640 /etc/lokawira/backend.env
```

Isi `/etc/lokawira/backend.env`. Untuk sandi dan kunci, buat nilai acak langsung di server, misalnya dengan `openssl rand -base64 48`:

```ini
NODE_ENV=production
DATABASE_URL=postgres://lokawira:SANDI_DB@127.0.0.1:5432/lokawira
DATABASE_SSL=false
DB_POOL_SIZE=10

BACKEND_HOST=127.0.0.1
BACKEND_PORT=4000
# Caddy ada di mesin yang sama, jadi proxy tepercaya cukup loopback
TRUST_PROXY=127.0.0.1
CORS_ORIGINS=FRONTEND_ORIGIN
FRONTEND_URL=https://DOMAIN
SESSION_MODE=bearer
SESSION_SECRET=ACAK_MINIMAL_32_KARAKTER
LOG_LEVEL=info

ADMIN_NAME=Pengelola LOKAWIRA
ADMIN_EMAIL=EMAIL_ADMIN
ADMIN_PASSWORD=SANDI_ADMIN_MINIMAL_10_KARAKTER

# Akun uji Tim Kurasi (dicantumkan di Lampiran G proposal). Set true selama penjurian, false setelahnya
DEMO_ACCOUNTS=true
DEMO_PASSWORD=demo1234

GEOFENCE_ENABLED=true
GEOFENCE_RADIUS_METERS=100

NINE_ROUTER_BASE_URL=http://127.0.0.1:20128/v1
NINE_ROUTER_API_KEY=KEY_DARI_DASBOR_9ROUTER
NINE_ROUTER_MODEL=gemini/gemini-3.1-flash-lite-preview,ag/gemini-3.8-flash-low,gemini/gemini-3.5-flash-lite
NINE_ROUTER_VISION_MODEL=ag/gemini-3.8-flash-low,gemini/gemini-3.5-flash-lite,gemini/gemini-3.1-flash-lite-preview
NINE_ROUTER_TIMEOUT_MS=15000
NINE_ROUTER_HEDGE_MS=2500
NINE_ROUTER_SCAN_TIMEOUT_MS=30000

# Email lupa sandi/verifikasi. Kalau kosong, fitur email tidak terkirim (aplikasi lain tetap jalan)
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=LOKAWIRA <noreply@DOMAIN>
```

Catatan:

- **`GEOFENCE_ENABLED`**: `true` artinya check-in dan pindai hanya sah di dekat titik. Saat demo di panggung yang jauh dari titik, putuskan dulu apakah perlu `false` sementara. Verifikasi KDR oleh pemilik lapak tetap jalan.
- **SMTP**: pakai layanan email transaksional, misalnya Brevo, Resend, atau Mailgun, dengan domain `DOMAIN`. Tambahkan record SPF/DKIM yang diminta layanannya supaya email tidak masuk spam.
- **`ADMIN_PASSWORD`** hanya dipakai saat akun admin pertama dibuat. Mengubahnya nanti tidak mengganti sandi admin yang sudah ada.

---

## 8. Service backend

Buat `/etc/systemd/system/lokawira-backend.service`:

```ini
[Unit]
Description=LOKAWIRA backend (Fastify)
After=network-online.target postgresql.service ninerouter.service
Wants=network-online.target
Requires=postgresql.service

[Service]
User=lokawira
WorkingDirectory=/srv/lokawira/app
EnvironmentFile=/etc/lokawira/backend.env
Environment=NODE_OPTIONS=--max-old-space-size=768
ExecStart=/srv/lokawira/app/node_modules/.bin/tsx --tsconfig backend/tsconfig.json backend/src/server.ts
Restart=always
RestartSec=3
TimeoutStopSec=15
MemoryMax=1G
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/srv/lokawira

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload && systemctl enable --now lokawira-backend
journalctl -u lokawira-backend -n 50 --no-pager
curl -s http://127.0.0.1:4000/api/health     # {"ok":true,...,"db":"up"}
```

Saat start, skema diterapkan otomatis (idempoten) dan data awal diisi, jadi `backend:migrate` tidak perlu dijalankan manual. Service ini memanggil `tsx` langsung, bukan lewat `npm run`, supaya tidak ada proses npm tambahan (hemat RAM) dan sinyal stop sampai ke Node.

---

## 9. Caddy (HTTPS otomatis)

```bash
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
apt update && apt -y install caddy
```

Isi `/etc/caddy/Caddyfile`:

```caddyfile
api.DOMAIN {
	encode zstd gzip

	# foto pindai/galeri maksimal 5 MB di backend; beri sedikit kelonggaran
	request_body {
		max_size 6MB
	}

	header {
		Strict-Transport-Security "max-age=31536000; includeSubDomains"
		X-Frame-Options "DENY"
		-Server
	}

	reverse_proxy 127.0.0.1:4000 {
		health_uri /api/health
		health_interval 30s
	}

	log {
		output file /var/log/caddy/api.log {
			roll_size 20MiB
			roll_keep 5
		}
	}
}
```

```bash
caddy validate --config /etc/caddy/Caddyfile && systemctl reload caddy
curl -s https://api.DOMAIN/api/health
```

Sertifikat Let's Encrypt terbit otomatis kalau DNS sudah benar dan port 80/443 terbuka.

---

## 10. Sambungkan frontend (Vercel)

Di Vercel buka **Project → Settings → Environment Variables (Production)**:

| Key | Value |
| --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | `https://api.DOMAIN` (tanpa `/` di akhir) |
| `NEXT_PUBLIC_DEMO_MODE` | `false` |

Hapus `MOCK_BACKEND` kalau ada. Lalu **Redeploy**. Variabel `NEXT_PUBLIC_*` ikut "dibakar" saat build, jadi redeploy wajib.

Pastikan setiap origin frontend (domain sendiri, `www`, dan `*.vercel.app` yang dipakai) tercantum di `CORS_ORIGINS`. Setelah mengubahnya: `systemctl restart lokawira-backend`.

Cek dari laptop. Header `access-control-allow-origin` harus muncul:

```bash
curl -si -H 'Origin: https://DOMAIN' https://api.DOMAIN/api/health | grep -i access-control
```

---

## 11. Verifikasi menyeluruh

### 11.1 QA otomatis, di database terpisah (jangan di database produksi)

`backend/qa/smoke.mjs` membuat akun dan transaksi uji. Jadi jalankan di database sementara:

```bash
sudo -u postgres psql -c "CREATE DATABASE lokawira_qa OWNER lokawira;"
# instance QA sementara: env produksi dibaca systemd (aman untuk nilai berspasi), lalu beberapa nilai ditimpa
systemd-run --unit=lokawira-qa --property=User=lokawira \
  --property=WorkingDirectory=/srv/lokawira/app \
  --property=EnvironmentFile=/etc/lokawira/backend.env \
  --setenv=DATABASE_URL=postgres://lokawira:SANDI_DB@127.0.0.1:5432/lokawira_qa \
  --setenv=BACKEND_PORT=4001 --setenv=DEMO_ACCOUNTS=true --setenv=GEOFENCE_ENABLED=true \
  /srv/lokawira/app/node_modules/.bin/tsx --tsconfig backend/tsconfig.json backend/src/server.ts
sleep 10 && curl -s http://127.0.0.1:4001/api/health
cd /srv/lokawira/app && B=http://127.0.0.1:4001 node backend/qa/smoke.mjs
systemctl stop lokawira-qa
sudo -u postgres psql -c "DROP DATABASE lokawira_qa;"
```

Semua cek harus lolos. Kalau ada yang gagal, **berhenti** dan laporkan output-nya (`journalctl -u lokawira-qa`); jangan lanjut ke produksi. Jangan mencetak isi `backend.env` dengan `cat` atau `echo`.

Uji AI nyata (opsional): `qa/ai.mjs` membutuhkan foto `celengan.jpg` dan `batik.jpg`. Lihat `backend/README.md`.

### 11.2 Daftar cek manual di produksi

- [ ] `https://api.DOMAIN/api/health` → `ok:true, db:up`
- [ ] Frontend di `https://DOMAIN` memuat peta, tanpa galat CORS atau mixed content di console browser
- [ ] Login `wisatawan@lokawira.demo` / `demo1234` berhasil (kalau `DEMO_ACCOUNTS=true`)
- [ ] Tanya Loka di satu titik → jawaban muncul dengan rujukan. Waktu tunggunya catat; normalnya di bawah 5 detik
- [ ] Mitra: kasir bisa menebus voucer. Pengelola: antrean persetujuan terbuka
- [ ] Login admin dengan `ADMIN_EMAIL` berhasil
- [ ] Dari luar VPS, `nc -zv VPS_IP 4000`, `nc -zv VPS_IP 5432`, dan `nc -zv VPS_IP 20128` **semuanya gagal/tertutup**

---

## 12. Backup database

Foto disimpan di dalam database (`bytea`), jadi backup ini mencakup semua data.

Buat `/usr/local/bin/lokawira-backup`:

```bash
#!/bin/sh
set -eu
DIR=/var/backups/lokawira
mkdir -p -m 700 "$DIR"
sudo -u postgres pg_dump -Fc lokawira > "$DIR/lokawira-$(date +%F).dump"
find "$DIR" -name 'lokawira-*.dump' -mtime +14 -delete
```

```bash
chmod 700 /usr/local/bin/lokawira-backup
echo '30 2 * * * root /usr/local/bin/lokawira-backup' > /etc/cron.d/lokawira-backup
/usr/local/bin/lokawira-backup && ls -lh /var/backups/lokawira
```

- **Salinan di luar VPS:** kalau VPS rusak, backup lokal ikut hilang. Salin rutin ke penyimpanan lain, misalnya `rclone` ke Google Drive tim atau object storage.
- **Uji pemulihan minimal sekali:**
  ```bash
  sudo -u postgres createdb lokawira_restore
  sudo -u postgres pg_restore -d lokawira_restore /var/backups/lokawira/lokawira-TANGGAL.dump
  sudo -u postgres dropdb lokawira_restore
  ```

---

## 13. Pemantauan

- **Uptime:** daftarkan `https://api.DOMAIN/api/health` di UptimeRobot atau Better Stack (gratis), interval 5 menit, notifikasi ke email tim. Endpoint ini mengembalikan 503 kalau DB putus.
- **Log:**
  ```bash
  journalctl -u lokawira-backend -f
  journalctl -u ninerouter -n 100
  tail -f /var/log/caddy/api.log
  ```
- **Peringatan `TRUST_PROXY`:** kalau log menulis "Permintaan lewat proxy ... yang tidak dipercaya", berarti IP asli pengunjung tidak terbaca dan batas login/daftar dipakai bersama. Perbaiki `TRUST_PROXY`.
- **Sumber daya:** `free -h`, `df -h`, `systemctl status lokawira-backend ninerouter postgresql caddy`.

---

## 14. Update versi baru

Buat `/usr/local/bin/lokawira-deploy`:

```bash
#!/bin/sh
set -eu
cd /srv/lokawira/app
PREV=$(sudo -u lokawira git rev-parse HEAD)
sudo -u lokawira git fetch origin main
sudo -u lokawira git reset --hard origin/main
sudo -u lokawira npm ci
sudo -u lokawira npm run backend:typecheck
/usr/local/bin/lokawira-backup
systemctl restart lokawira-backend
sleep 5
if ! curl -fsS http://127.0.0.1:4000/api/health >/dev/null; then
  echo "Health gagal, kembali ke $PREV"
  sudo -u lokawira git reset --hard "$PREV"
  sudo -u lokawira npm ci
  systemctl restart lokawira-backend
  exit 1
fi
echo "Deploy OK: $(sudo -u lokawira git rev-parse --short HEAD)"
```

```bash
chmod 700 /usr/local/bin/lokawira-deploy
```

`git reset --hard` di sini aman karena folder di VPS tidak boleh diedit manual; semua perubahan lewat repo. Skema DB idempoten dan hanya menambah, jadi rollback kode tidak merusak data.

---

## 15. Optimasi dan saran

| Area | Saran |
| --- | --- |
| **Lokasi VPS** | Pilih Jakarta atau Singapura. Latensi pengguna di Indonesia dan ke Vercel `sin1` jadi kecil. |
| **RAM** | Perkiraan pemakaian: Postgres 300–600 MB (termasuk `shared_buffers`), backend 200–300 MB, 9router 100–200 MB, Caddy ~30 MB. Sisa RAM dipakai cache OS. Kalau `free -h` menunjukkan swap terus terpakai, turunkan `shared_buffers` ke 256MB. |
| **Pool DB** | `DB_POOL_SIZE=10` cukup untuk satu proses backend. Jangan menaikkannya melebihi `max_connections` dikurangi 10. |
| **Kecepatan Loka** | Urutan model di `NINE_ROUTER_MODEL` = urutan percobaan. Server mencatat model yang sehat dan cepat lalu mendahulukannya. Kalau satu model sering lambat, pindahkan ke belakang. `NINE_ROUTER_HEDGE_MS=2500` artinya model cadangan ikut jalan setelah 2,5 detik. |
| **Kuota AI** | 9router bergantung pada kuota akun penyedia. Sebelum showcase, sambungkan lebih dari satu akun/penyedia. Selama showcase, pantau `journalctl -u ninerouter`. |
| **Update 9router** | Service memakai `--skip-update` supaya versi tidak berubah sendiri menjelang showcase. Update manual (`npm i -g 9router@VERSI && systemctl restart ninerouter`) hanya saat tenang, lalu uji Loka. |
| **Pertumbuhan disk** | Foto ada di Postgres. Pantau dengan `sudo -u postgres psql -c "select pg_size_pretty(pg_database_size('lokawira'))"`. Kalau sudah lebih dari beberapa GB, pindahkan foto ke object storage. |
| **Keamanan** | Pertahankan `fail2ban` dan `unattended-upgrades`. Rotasi `SESSION_SECRET` kalau pernah bocor (semua sesi akan keluar). Ganti sandi admin dari dalam aplikasi setelah login pertama. |
| **Setelah penjurian** | Set `DEMO_ACCOUNTS=false` lalu restart backend. Akun uji tidak bisa diganti sandinya, jadi jangan dibiarkan aktif. |
| **Dependensi** | `npm audit` menandai MapLibre (XSS di `setHTML`, tidak dipakai di kode), Zod (validasi koleksi besar, tidak dipakai; body dibatasi 1 MB), dan Next/PostCSS (sedang). Upgrade versi mayor sebaiknya **setelah** showcase, dengan uji e2e lengkap. |
| **Skala** | Satu VPS 4 GB cukup untuk uji coba (ratusan titik, ribuan transaksi). Batas desain ada di bagian "Batas yang diketahui" di `backend/README.md`. |

---

## 16. Pemecahan masalah cepat

| Gejala | Penyebab umum | Tindakan |
| --- | --- | --- |
| Frontend: "Backend belum tersambung" / `MOCK_DISABLED` | `NEXT_PUBLIC_API_BASE_URL` kosong, atau frontend belum di-redeploy | Isi env di Vercel, lalu Redeploy |
| Galat CORS di console | Origin frontend tidak ada di `CORS_ORIGINS` | Tambahkan origin yang persis sama (https, tanpa `/`), lalu restart backend |
| Backend tidak mau start | `DATABASE_URL` salah atau `SESSION_SECRET` kurang dari 32 karakter | `journalctl -u lokawira-backend -n 50` |
| Health 503 `db:down` | Postgres mati atau sandi salah | `systemctl status postgresql`, cek `DATABASE_URL` |
| Loka selalu jawab "dari data tercatat" | 9router mati, API key salah, atau model tidak tersedia/kuota habis | `systemctl status ninerouter`, tes model di dasbor lewat tunnel |
| Pindai selalu ditolak | Model visi tidak bisa membaca gambar, atau geofence menolak karena jauh dari titik | Cek `NINE_ROUTER_VISION_MODEL` dan `GEOFENCE_ENABLED` |
| Upload foto gagal 413 | Foto lebih dari 5 MB | Perkecil foto (kompresi di sisi aplikasi) |
| Sertifikat HTTPS tidak terbit | DNS belum mengarah ke VPS, port 80 tertutup, atau Cloudflare mode Proxied | `dig api.DOMAIN`, `ufw status`, `journalctl -u caddy` |

---

## Lampiran: alternatif tanpa VPS (gratis)

Kalau VPS bermasalah, backend bisa sementara dipindah ke **Render** (Web Service, region Singapore, start command `npm run backend:start`, health check `/api/health`) dengan database **Neon** (region Singapore, `DATABASE_SSL=true`). Di sana `TRUST_PROXY` harus diisi rentang IP proxy platformnya. Paket gratis Render tidur setelah 15 menit tanpa trafik (cold start sekitar 30 detik), dan **tidak ada 9router**, jadi Loka berjalan dalam mode data tercatat. `backend/Dockerfile` juga tersedia untuk platform berbasis Docker seperti Koyeb (port 4000).
