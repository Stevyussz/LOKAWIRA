import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { pool, closePool, migrate } from "./db.js";
import { HttpError } from "./core.js";
import { allowedOrigins, authHook } from "./http.js";
import { seed } from "./seed.js";
import authRoutes from "./routes/auth.js";
import spotRoutes from "./routes/spots.js";
import economyRoutes from "./routes/economy.js";
import aiRoutes from "./routes/ai.js";
import adminRoutes from "./routes/admin.js";
import agendaRoutes from "./routes/agenda.js";
import { GEOFENCE_ON, RADIUS_M } from "./geofence.js";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function buildApp() {
  // trustProxy: ambil IP asli dr X-Forwarded-For. Isi TRUST_PROXY dgn IP reverse proxy (default: loopback aja)
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? "info" }, bodyLimit: 1024 * 1024, trustProxy: process.env.TRUST_PROXY ?? "127.0.0.1" });

  app.decorateRequest("authUser", null);
  app.decorateRequest("sessionToken", null);
  app.register(cors, {
    origin(origin, cb) {
      if (!origin || allowedOrigins().includes(origin)) cb(null, true);
      else cb(null, false);
    },
    credentials: process.env.SESSION_MODE === "cookie",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type"],
    maxAge: 600,
  });
  app.register(multipart, { limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 10 } });
  // ada X-Forwarded-For tapi IP-nya gak dipake = proxy di depan server belum dipercaya (TRUST_PROXY salah).
  // Akibatnya semua pengunjung kebaca 1 IP & batas daftar/login/check-in tamu jadi dipakai bareng. Diingetin sekali di log
  let proxyWarned = false;
  app.addHook("onRequest", async (request) => {
    if (!proxyWarned && request.headers["x-forwarded-for"] && request.ip === request.socket.remoteAddress) {
      proxyWarned = true;
      request.log.warn({ proxy: request.ip }, `Permintaan lewat proxy ${request.ip} yang tidak dipercaya. Isi TRUST_PROXY dengan IP proxy itu supaya IP asli pengunjung terbaca.`);
    }
  });
  app.addHook("onRequest", authHook);
  app.addHook("onSend", async (_req, reply) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("Referrer-Policy", "no-referrer");
  });

  app.setErrorHandler((cause, request, reply) => {
    if (cause instanceof HttpError) {
      return reply.code(cause.status).send({ error: cause.message, ...(cause.code ? { code: cause.code } : {}), ...(cause.details ? { details: cause.details } : {}) });
    }
    const status = (cause as { statusCode?: number }).statusCode;
    if (status === 413 || (cause as { code?: string }).code === "FST_REQ_FILE_TOO_LARGE") return reply.code(413).send({ error: "Foto atau data lebih dari batas ukuran.", code: "IMAGE_TOO_LARGE" });
    if (status && status >= 400 && status < 500) return reply.code(status).send({ error: "Format permintaan tidak valid.", code: "BAD_REQUEST" });
    request.log.error(cause);
    return reply.code(500).send({ error: "Terjadi kendala di server. Coba lagi sebentar.", code: "INTERNAL_ERROR" });
  });
  app.setNotFoundHandler((_req, reply) => reply.code(404).send({ error: "Alamat API tidak ditemukan.", code: "NOT_FOUND" }));

  // health ikut ngecek DB, biar monitor tau kalo Postgres putus
  app.get("/api/health", async (_req, reply) => {
    try {
      await pool.query("SELECT 1");
    } catch {
      return reply.code(503).send({ ok: false, db: "down", time: new Date().toISOString() });
    }
    return { ok: true, version: process.env.npm_package_version ?? "1.0.0", time: new Date().toISOString(), db: "up", ...(GEOFENCE_ON ? { checkInRadiusMeters: RADIUS_M } : {}) };
  });

  app.register(authRoutes);
  app.register(spotRoutes);
  app.register(economyRoutes);
  app.register(aiRoutes);
  app.register(adminRoutes);
  app.register(agendaRoutes);
  return app;
}

async function start() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL wajib diisi.");
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) throw new Error("SESSION_SECRET minimal 32 karakter.");
  await migrate();
  await seed();
  const app = buildApp();
  // bersihin limiter & sesi yg udah lewat tiap jam (tabelnya gak numpuk)
  const sweep = () =>
    Promise.all([
      pool.query("DELETE FROM rate_limits WHERE reset_at < now() - interval '1 hour'"),
      pool.query("DELETE FROM sessions WHERE expires_at < now()"),
      pool.query("DELETE FROM one_time_tokens WHERE expires_at < now()"),
    ]).catch((e) => app.log.warn({ err: e }, "Pembersihan gagal"));
  await sweep();
  const timer = setInterval(sweep, 3600_000);
  timer.unref();
  await app.listen({ port: Number(process.env.BACKEND_PORT) || 4000, host: process.env.BACKEND_HOST ?? "0.0.0.0" });
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, async () => {
      await app.close();
      await closePool();
      process.exit(0);
    });
  }
}

start().catch(async (cause) => {
  console.error(cause);
  await closePool().catch(() => {});
  process.exit(1);
});
