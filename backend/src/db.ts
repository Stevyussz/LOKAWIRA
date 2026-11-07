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

// pool atau client transaksi, dua2nya punya .query
export type Db = pg.Pool | pg.PoolClient;

export async function migrate() {
  const schema = await readFile(resolve(__dirname, "../schema.sql"), "utf8");
  await pool.query(schema);
}

// jalanin fn dlm satu transaksi. Lempar error = rollback
export async function tx<T>(fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (cause) {
    await client.query("ROLLBACK").catch(() => {});
    throw cause;
  } finally {
    client.release();
  }
}

export async function closePool() {
  await pool.end();
}
