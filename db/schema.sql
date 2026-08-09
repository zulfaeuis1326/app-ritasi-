-- Referensi saja — skema ini dibuat OTOMATIS oleh aplikasi (lihat lib/db.js)
-- saat request pertama masuk. Tidak perlu dijalankan manual.

CREATE TABLE IF NOT EXISTS units (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
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
