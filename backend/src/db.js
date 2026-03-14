import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS loads (
      id BIGSERIAL PRIMARY KEY,
      load_id TEXT NOT NULL,
      source TEXT NOT NULL,
      from_city TEXT NOT NULL,
      to_city TEXT NOT NULL,
      pickup TEXT NOT NULL,
      distance TEXT NOT NULL,
      ends_in TEXT DEFAULT '',
      status TEXT DEFAULT '',
      pickup_full TEXT DEFAULT '',
      delivery_full TEXT DEFAULT '',
      fingerprint TEXT NOT NULL UNIQUE,
      first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ
    );
  `);

  await pool.query(`
    ALTER TABLE loads
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_loads_created_at ON loads (created_at DESC);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_loads_expires_at ON loads (expires_at);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_loads_status ON loads (status);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_loads_load_id ON loads (load_id);
  `);
}
