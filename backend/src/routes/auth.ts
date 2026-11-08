import crypto from "node:crypto";
import type { FastifyInstance } from "fastify";
import nodemailer from "nodemailer";
import { z } from "zod";
import type { IssuedVoucher, ReservationPass } from "@/types/lokawira";
import { pool, tx } from "../db.js";
import { bad, fail, hashPassword, newId, passwordMatches, profileOf, rateLimit, sha } from "../core.js";
import { blockDemoAccount, bodyOf, clearSessionCookie, issueSession, requireRoles, safeUser, USER_COLS, type UserRow } from "../http.js";

const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(120),
  password: z.string().min(8).max(200),
  role: z.enum(["VISITOR", "MERCHANT"]),
});
const loginSchema = z.object({ email: z.string().trim().email(), password: z.string().min(1).max(200) });
const passwordSchema = z.string().min(8).max(200);

async function sendMail(to: string, subject: string, text: string) {
  if (!process.env.SMTP_HOST) throw new Error("SMTP_HOST belum dikonfigurasi.");
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
  });
  await transport.sendMail({ from: process.env.SMTP_FROM ?? "LOKAWIRA <noreply@example.id>", to, subject, text });
}
const frontendUrl = () => (process.env.FRONTEND_URL ?? "http://localhost:3000").replace(/\/$/, "");

// voucer & tiket milik akun ini (wisatawan)
export async function myRecords(userId: string) {
  const [v, r] = await Promise.all([
    pool.query<{ payload: IssuedVoucher }>("SELECT payload FROM entities WHERE kind='voucher' AND owner_id=$1 ORDER BY created_at DESC", [userId]),
    pool.query<{ payload: ReservationPass }>("SELECT payload FROM entities WHERE kind='reservation' AND owner_id=$1 ORDER BY created_at DESC", [userId]),
  ]);
  return { vouchers: v.rows.map((x) => x.payload), reservations: r.rows.map((x) => x.payload) };
}

export default async function authRoutes(app: FastifyInstance) {
  app.post("/api/auth/register", async (request, reply) => {
    await rateLimit(pool, `register:${request.ip}`, 10, 3600, "Terlalu banyak percobaan pendaftaran. Coba lagi nanti.");
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) bad("Nama, email, atau kata sandi belum sesuai. Kata sandi minimal 8 karakter.");
    const { name, email, password, role } = parsed.data;
    const salt = crypto.randomBytes(16).toString("hex");
    const userId = newId("usr");
    try {
      const r = await pool.query<UserRow>(
        `INSERT INTO users(id,email,name,role,status,password_salt,password_hash) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING ${USER_COLS}`,
        [userId, email.toLowerCase(), name, role, role === "MERCHANT" ? "PENDING" : null, salt, await hashPassword(password, salt)]
      );
      await pool.query("INSERT INTO profiles(user_id) VALUES($1) ON CONFLICT DO NOTHING", [userId]);
      return reply.code(201).send({ ...(await issueSession(reply, userId)), user: safeUser(r.rows[0]) });
    } catch (cause) {
      if ((cause as { code?: string }).code === "23505") fail(409, "Email sudah terdaftar.", "EMAIL_TAKEN");
      throw cause;
    }
  });

  app.post("/api/auth/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) bad("Email dan kata sandi wajib diisi dengan benar.");
    const email = parsed.data.email.toLowerCase();
    // batas per IP: nebak sandi pakai banyak email beda dr satu jaringan. Longgar biar 1 WiFi uji lapangan tetap aman
    await rateLimit(pool, `login-ip:${request.ip}`, 60, 600, "Terlalu banyak percobaan masuk dari jaringan ini. Coba lagi beberapa menit lagi.");
    const key = `login:${email}`;
    const lim = await pool.query<{ count: number; reset_at: Date }>("SELECT count,reset_at FROM rate_limits WHERE key=$1", [key]);
    if (lim.rows[0] && lim.rows[0].count >= 5 && lim.rows[0].reset_at > new Date()) fail(429, "Terlalu banyak percobaan. Coba lagi sebentar lagi.", "RATE_LIMITED");
    const r = await pool.query<UserRow>(`SELECT ${USER_COLS} FROM users WHERE email=$1`, [email]);
    const user = r.rows[0];
    // hash tetap dihitung walau email gak ada: waktunya sama, gak bocorin email mana yg terdaftar
    const ok = user ? await passwordMatches(parsed.data.password, user.password_salt, user.password_hash) : (await hashPassword(parsed.data.password, "x".repeat(32)), false);
    if (!ok) {
      await pool.query(
        "INSERT INTO rate_limits(key,count,reset_at) VALUES($1,1,now()+interval '60 seconds') ON CONFLICT(key) DO UPDATE SET count=CASE WHEN rate_limits.reset_at<now() THEN 1 ELSE rate_limits.count+1 END,reset_at=CASE WHEN rate_limits.reset_at<now() THEN now()+interval '60 seconds' ELSE rate_limits.reset_at END",
        [key]
      );
      fail(401, "Email atau kata sandi salah.", "BAD_CREDENTIALS");
    }
    await pool.query("DELETE FROM rate_limits WHERE key=$1", [key]);
    return { ...(await issueSession(reply, user.id)), user: safeUser(user) };
  });

  app.get("/api/auth/me", async (request) => {
    if (!request.authUser) fail(401, "Sesi tidak ditemukan atau sudah berakhir.", "UNAUTHENTICATED");
    return { user: request.authUser };
  });

  app.post("/api/auth/logout", async (request, reply) => {
    if (!request.authUser || !request.sessionToken) fail(401, "Silakan masuk terlebih dahulu.", "UNAUTHENTICATED");
    await pool.query("DELETE FROM sessions WHERE token_hash=$1", [sha(request.sessionToken)]);
    clearSessionCookie(reply);
    return { ok: true };
  });

  app.get("/api/me/profile", async (request) => {
    const user = requireRoles(request, ["VISITOR", "MERCHANT", "ADMIN"], { allowInactiveMerchant: true });
    const prof = await profileOf(pool, user.id);
    const ci = await pool.query<{ spot: string }>("SELECT DISTINCT payload->>'spotId' AS spot FROM entities WHERE kind='checkin' AND owner_id=$1", [user.id]);
    return { xp: prof.xp, level: Math.floor(prof.xp / 150) + 1, checkedInSpotIds: ci.rows.map((x) => x.spot), loreCards: prof.lore_cards, ...(await myRecords(user.id)) };
  });

  app.post("/api/auth/change-password", async (request, reply) => {
    const user = requireRoles(request, ["VISITOR", "MERCHANT", "ADMIN"], { allowInactiveMerchant: true });
    blockDemoAccount(user.id);
    const b = bodyOf(request);
    if (typeof b.currentPassword !== "string" || !passwordSchema.safeParse(b.newPassword).success) bad("Kata sandi baru minimal 8 karakter.");
    const r = await pool.query<UserRow>(`SELECT ${USER_COLS} FROM users WHERE id=$1`, [user.id]);
    const row = r.rows[0];
    if (!row || !(await passwordMatches(b.currentPassword as string, row.password_salt, row.password_hash))) fail(401, "Kata sandi saat ini salah.", "BAD_CREDENTIALS");
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = await hashPassword(b.newPassword as string, salt);
    await tx(async (c) => {
      await c.query("UPDATE users SET password_salt=$1,password_hash=$2 WHERE id=$3", [salt, hash, user.id]);
      // sandi berubah: semua sesi lama dicabut
      await c.query("DELETE FROM sessions WHERE user_id=$1", [user.id]);
    });
    return { ok: true, ...(await issueSession(reply, user.id)) };
  });

  // hapus akun: titik mitra diarsip, catatan dianonimkan, foto contoh dihapus
  app.delete("/api/me", async (request, reply) => {
    const user = requireRoles(request, ["VISITOR", "MERCHANT", "ADMIN"], { allowInactiveMerchant: true });
    blockDemoAccount(user.id);
    const password = bodyOf(request).password;
    if (typeof password !== "string" || !password) bad("Masukkan kata sandi untuk mengonfirmasi.");
    const r = await pool.query<UserRow>(`SELECT ${USER_COLS} FROM users WHERE id=$1`, [user.id]);
    if (!r.rows[0] || !(await passwordMatches(password as string, r.rows[0].password_salt, r.rows[0].password_hash))) fail(401, "Kata sandi salah.", "BAD_CREDENTIALS");
    if (user.role === "ADMIN") {
      const admins = await pool.query("SELECT 1 FROM users WHERE role='ADMIN' AND id<>$1", [user.id]);
      if (!admins.rowCount) fail(409, "Ini satu-satunya akun pengelola. Buat pengelola lain dulu sebelum menghapus akun ini.", "LAST_ADMIN");
    }
    await tx(async (c) => {
      const spots = await c.query<{ id: string }>("SELECT id FROM entities WHERE kind='spot' AND owner_id=$1", [user.id]);
      const ids = spots.rows.map((x) => x.id);
      if (ids.length) {
        await c.query("DELETE FROM entities WHERE kind IN ('reference-image','gallery-image') AND owner_id = ANY($1)", [ids]);
        await c.query("DELETE FROM entities WHERE kind='event' AND payload->>'spotId' = ANY($1)", [ids]);
      }
      await c.query(
        "UPDATE entities SET owner_id=NULL, payload=jsonb_set(jsonb_set(payload - 'ownerId' - 'gallery','{status}','\"ARCHIVED\"'::jsonb),'{quest,referenceImages}','[]'::jsonb) WHERE kind='spot' AND owner_id=$1",
        [user.id]
      );
      await c.query("UPDATE entities SET owner_id=NULL,payload=jsonb_set(payload,'{visitorName}','\"Pengunjung\"'::jsonb) WHERE kind='reservation' AND owner_id=$1", [user.id]);
      await c.query("UPDATE entities SET owner_id=NULL WHERE kind IN ('voucher','checkin') AND owner_id=$1", [user.id]);
      await c.query("DELETE FROM users WHERE id=$1", [user.id]);
    });
    clearSessionCookie(reply);
    return { ok: true };
  });

  app.post("/api/auth/forgot-password", async (request) => {
    const email = String(bodyOf(request).email ?? "").trim().toLowerCase();
    if (!email) bad("Email wajib diisi.");
    await rateLimit(pool, `forgot:${request.ip}`, 5, 3600, "Terlalu banyak permintaan. Coba lagi nanti.");
    const r = await pool.query<{ id: string }>("SELECT id FROM users WHERE email=$1", [email]);
    // respons selalu sama: gak bocorin email mana yg terdaftar
    if (r.rows[0] && process.env.SMTP_HOST && !(process.env.DEMO_ACCOUNTS === "true" && email.endsWith("@lokawira.demo"))) {
      const token = crypto.randomBytes(32).toString("base64url");
      await pool.query("INSERT INTO one_time_tokens(token_hash,user_id,purpose,expires_at) VALUES($1,$2,'RESET_PASSWORD',now()+interval '30 minutes')", [sha(token), r.rows[0].id]);
      sendMail(email, "Atur ulang kata sandi LOKAWIRA", `Buka ${frontendUrl()}/lupa-sandi?token=${encodeURIComponent(token)} untuk mengatur ulang kata sandi. Tautan berlaku 30 menit.`).catch((e) =>
        app.log.error({ err: e }, "Email reset sandi gagal dikirim")
      );
    }
    return { ok: true };
  });

  app.post("/api/auth/reset-password", async (request) => {
    const b = bodyOf(request);
    if (typeof b.token !== "string" || !b.token || !passwordSchema.safeParse(b.password).success) bad("Tautan atau kata sandi tidak valid.");
    const r = await pool.query<{ user_id: string }>("DELETE FROM one_time_tokens WHERE token_hash=$1 AND purpose='RESET_PASSWORD' AND expires_at>now() RETURNING user_id", [sha(b.token as string)]);
    if (!r.rows[0]) fail(400, "Tautan atur ulang tidak valid atau sudah kedaluwarsa.", "TOKEN_INVALID_OR_EXPIRED");
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = await hashPassword(b.password as string, salt);
    await tx(async (c) => {
      await c.query("UPDATE users SET password_salt=$1,password_hash=$2 WHERE id=$3", [salt, hash, r.rows[0].user_id]);
      await c.query("DELETE FROM sessions WHERE user_id=$1", [r.rows[0].user_id]);
    });
    return { ok: true };
  });

  app.post("/api/auth/verify-email", async (request) => {
    const token = String(bodyOf(request).token ?? "");
    const r = await pool.query<{ user_id: string }>("DELETE FROM one_time_tokens WHERE token_hash=$1 AND purpose='VERIFY_EMAIL' AND expires_at>now() RETURNING user_id", [sha(token)]);
    if (!r.rows[0]) fail(400, "Tautan verifikasi tidak valid atau sudah kedaluwarsa.", "TOKEN_INVALID_OR_EXPIRED");
    await pool.query("UPDATE users SET email_verified=true WHERE id=$1", [r.rows[0].user_id]);
    return { ok: true };
  });

  app.post("/api/auth/resend-verification", async (request) => {
    const user = requireRoles(request, ["VISITOR", "MERCHANT", "ADMIN"], { allowInactiveMerchant: true });
    const r = await pool.query<{ email_verified: boolean }>("SELECT email_verified FROM users WHERE id=$1", [user.id]);
    if (r.rows[0]?.email_verified) return { ok: true };
    await rateLimit(pool, `verify:${user.id}`, 1, 60, "Terlalu banyak permintaan. Coba lagi nanti.");
    if (!process.env.SMTP_HOST) fail(503, "Pengiriman email belum dikonfigurasi di server.", "EMAIL_UNAVAILABLE");
    const token = crypto.randomBytes(32).toString("base64url");
    await pool.query("INSERT INTO one_time_tokens(token_hash,user_id,purpose,expires_at) VALUES($1,$2,'VERIFY_EMAIL',now()+interval '24 hours')", [sha(token), user.id]);
    sendMail(user.email, "Verifikasi email LOKAWIRA", `Buka ${frontendUrl()}/verifikasi-email?token=${encodeURIComponent(token)} untuk memverifikasi email.`).catch((e) =>
      app.log.error({ err: e }, "Email verifikasi gagal dikirim")
    );
    return { ok: true };
  });
}
