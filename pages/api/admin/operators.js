const { pool, ensureSchema } = require("../../../lib/db");
const { getUserFromReq } = require("../../../lib/auth");
const { atLeast, ALL_ROLES } = require("../../../lib/roles");

export default async function handler(req, res) {
  try {
    await ensureSchema();
    const user = await getUserFromReq(req);
    if (!user) return res.status(401).json({ error: "Belum login" });
    if (!atLeast(user.role, "admin")) {
      return res.status(403).json({ error: "Hanya admin/superadmin yang bisa mengakses ini" });
    }

    if (req.method === "GET") {
      const result = await pool.query(
        `SELECT u.id, u.username, u.role, u.unit_id, un.name AS unit_name, u.created_at
         FROM users u
         LEFT JOIN units un ON un.id = u.unit_id
         ORDER BY u.role, u.username`
      );
      return res.status(200).json(result.rows);
    }

    if (req.method === "POST") {
      // action: "reset_unit" (default, kompatibel dengan yang lama) atau "set_role"
      const { userId, action, newRole } = req.body || {};
      if (!userId) return res.status(400).json({ error: "userId wajib diisi" });

      if (action === "set_role") {
        if (!ALL_ROLES.includes(newRole)) {
          return res.status(400).json({ error: "Role tidak valid" });
        }
        // Admin biasa cuma boleh atur pengawas/operator — tidak boleh bikin admin/superadmin baru,
        // supaya eskalasi wewenang cuma bisa dilakukan superadmin.
        if (user.role === "admin" && (newRole === "admin" || newRole === "superadmin")) {
          return res.status(403).json({ error: "Hanya superadmin yang bisa menjadikan seseorang admin/superadmin" });
        }
        await pool.query(`UPDATE users SET role = $1 WHERE id = $2`, [newRole, userId]);
        return res.status(200).json({ ok: true });
      }

      // Reset unit operator (misal salah pilih di awal) — dikosongkan lagi supaya
      // operator diminta memilih ulang saat login berikutnya.
      await pool.query(`UPDATE users SET unit_id = NULL WHERE id = $1 AND role = 'operator'`, [userId]);
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).end();
  } catch (err) {
    console.error("Error di /api/admin/operators:", err);
    return res.status(500).json({ error: err.message });
  }
}
