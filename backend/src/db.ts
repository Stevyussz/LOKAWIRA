import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DB_POOL_SIZE) || 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined,
});

export async function migrate() {
  const schema = await readFile(resolve(process.cwd(), "backend/schema.sql"), "utf8");
  await pool.query(schema);
}

export async function closePool() {
  await pool.end();
}
