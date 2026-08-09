const { pool } = require("./db");
const { buildShiftLabel } = require("./time");

// Selalu ada maksimal SATU shift berstatus 'open'. Kalau belum ada, dibuat otomatis
// berdasarkan jam saat ini (bukan dipilih manual).
async function getOrCreateOpenShift() {
  const existing = await pool.query(
    `SELECT * FROM shifts WHERE status = 'open' ORDER BY id DESC LIMIT 1`
  );
  if (existing.rows.length > 0) return existing.rows[0];

  const { shiftType, label } = buildShiftLabel();
  const inserted = await pool.query(
    `INSERT INTO shifts (shift_type, label, status) VALUES ($1, $2, 'open') RETURNING *`,
    [shiftType, label]
  );
  return inserted.rows[0];
}

module.exports = { getOrCreateOpenShift };
