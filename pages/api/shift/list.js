const { pool, ensureSchema } = require("../../../lib/db");

export default async function handler(req, res) {
  await ensureSchema();

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end();
  }

  const result = await pool.query(
    `SELECT id, shift_type, label, opened_at, closed_at, status
     FROM shifts
     ORDER BY id DESC
     LIMIT 30`
  );
  return res.status(200).json(result.rows);
}
