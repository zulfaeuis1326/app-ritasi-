const { Pool } = require("pg");

// Railway otomatis inject DATABASE_URL begitu plugin PostgreSQL ditambahkan.
// Koneksi internal Railway (host *.railway.internal) TIDAK butuh SSL — kalau dipaksa SSL,
// koneksi gagal total tanpa pesan error yang jelas di frontend. Hanya nyalakan SSL kalau
// connection string eksplisit minta (sslmode=require), misal saat pakai proxy publik.
const needsSSL = (process.env.DATABASE_URL || "").includes("sslmode=require");
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: needsSSL ? { rejectUnauthorized: false } : false,
});

pool.on("error", (err) => {
  console.error("Postgres pool error:", err);
});

let schemaReady = false;

// Dipanggil di awal setiap API route. Idempotent — aman dipanggil berkali-kali.
async function ensureSchema() {
  if (schemaReady) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS units (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS shifts (
      id SERIAL PRIMARY KEY,
      shift_type SMALLINT NOT NULL,       -- 1 = siang (07-19), 2 = malam (19-07)
      label TEXT NOT NULL,
      opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      closed_at TIMESTAMPTZ,
      status TEXT NOT NULL DEFAULT 'open' -- 'open' | 'closed'
    );

    CREATE TABLE IF NOT EXISTS ritasi_clicks (
      id SERIAL PRIMARY KEY,
      unit_id INTEGER NOT NULL REFERENCES units(id),
      shift_id INTEGER NOT NULL REFERENCES shifts(id),
      material TEXT NOT NULL,
      jam SMALLINT NOT NULL,
      clicked_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_clicks_shift ON ritasi_clicks(shift_id);
    CREATE INDEX IF NOT EXISTS idx_clicks_unit_shift ON ritasi_clicks(unit_id, shift_id);

    -- Migrasi: kalau tabel units dibuat versi lama (UNIQUE mentah di kolom name),
    -- hapus constraint itu — soalnya bikin nama unit yang sudah dihapus (nonaktif)
    -- tidak bisa dipakai ulang.
    ALTER TABLE units DROP CONSTRAINT IF EXISTS units_name_key;

    -- Nama unit hanya perlu unik di antara unit yang MASIH AKTIF.
    -- Unit yang sudah dihapus (nonaktif) tidak lagi menahan nama itu.
    CREATE UNIQUE INDEX IF NOT EXISTS units_name_active_key ON units(name) WHERE active = true;

    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'operator', -- 'admin' | 'operator'
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- Catat siapa yang input tiap klik ritasi. Nullable supaya data lama (sebelum ada
    -- sistem login) tidak error — cukup tampil sebagai "tanpa nama" di riwayat lama.
    ALTER TABLE ritasi_clicks ADD COLUMN IF NOT EXISTS operator_id INTEGER REFERENCES users(id);
  `);

  schemaReady = true;
}

module.exports = { pool, ensureSchema };
