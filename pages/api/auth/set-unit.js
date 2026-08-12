const { pool, ensureSchema } = require("../../../lib/db");
const { getUserFromReq } = require("../../../lib/auth");

export default async function handler(req, res) {
  try {
    await ensureSchema();
    const user = await getUserFromReq(req);
    if (!user) return res.status(401).json({ error: "Belum login" });

    if (req.method !== "POST") {
      res.setHeader("Allow", ["POST"]);
      return res.status(405).end();
    }

    if (user.role !== "operator") {
      return res.status(400).json({ error: "Hanya akun operator yang perlu memilih unit" });
    }

    // Server-side enforce: sekali sudah terisi, tidak bisa diganti sendiri.
    // Cuma admin (lewat /api/admin/operators) yang boleh reset.
    if (user.unit_id) {
      return res.status(403).json({ error: "Unit kamu sudah terkunci. Minta admin untuk reset kalau salah pilih." });
    }

    const { unitId } = req.body || {};
    if (!unitId) return res.status(400).json({ error: "unitId wajib diisi" });

    const unitCheck = await pool.query(`SELECT id FROM units WHERE id = $1 AND active = true`, [unitId]);
    if (unitCheck.rows.length === 0) {
      return res.status(400).json({ error: "Unit tidak ditemukan/tidak aktif" });
    }

    await pool.query(`UPDATE users SET unit_id = $1 WHERE id = $2`, [unitId, user.id]);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Error di /api/auth/set-unit:", err);
    return res.status(500).json({ error: err.message });
  }
}
