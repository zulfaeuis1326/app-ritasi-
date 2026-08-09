const { pool, ensureSchema } = require("../../../lib/db");
const { getOrCreateOpenShift } = require("../../../lib/shift");
const { buildRecap } = require("../../../lib/recap");

export default async function handler(req, res) {
  try {
    await ensureSchema();

    if (req.method === "GET") {
      const shift = await getOrCreateOpenShift();
      const result = await pool.query(
        `SELECT rc.id, rc.unit_id, u.name AS unit_name, rc.material, rc.jam, rc.clicked_at
         FROM ritasi_clicks rc
         JOIN units u ON u.id = rc.unit_id
         WHERE rc.shift_id = $1
         ORDER BY rc.id DESC
         LIMIT 50`,
        [shift.id]
      );
      return res.status(200).json({ shiftId: shift.id, clicks: result.rows });
    }

    if (req.method === "DELETE") {
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: "id klik wajib diisi" });

      const deleted = await pool.query(
        `DELETE FROM ritasi_clicks WHERE id = $1 RETURNING shift_id`,
        [id]
      );
      if (deleted.rows.length === 0) {
        return res.status(404).json({ error: "Data ritasi tidak ditemukan (mungkin sudah dihapus)" });
      }

      const shiftId = deleted.rows[0].shift_id;
      const recap = await buildRecap(shiftId);
      return res.status(200).json({ deleted: true, recap });
    }

    res.setHeader("Allow", ["GET", "DELETE"]);
    return res.status(405).end();
  } catch (err) {
    console.error("Error di /api/ritasi/history:", err);
    return res.status(500).json({ error: err.message });
  }
}

