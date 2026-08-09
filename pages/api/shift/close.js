const { pool, ensureSchema } = require("../../../lib/db");
const { getOrCreateOpenShift } = require("../../../lib/shift");
const { buildRecap } = require("../../../lib/recap");

export default async function handler(req, res) {
  await ensureSchema();

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end();
  }

  const shift = await getOrCreateOpenShift();
  const recap = await buildRecap(shift.id);

  await pool.query(
    `UPDATE shifts SET status = 'closed', closed_at = now() WHERE id = $1`,
    [shift.id]
  );

  // Shift berikutnya otomatis dibuat begitu ada klik baru (getOrCreateOpenShift),
  // jadi di sini kita tidak perlu buat manual — cukup pastikan shift lama benar tertutup.

  return res.status(200).json({ closedShiftId: shift.id, recap });
}
