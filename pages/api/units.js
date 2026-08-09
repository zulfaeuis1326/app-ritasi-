const { pool, ensureSchema } = require("../../lib/db");

export default async function handler(req, res) {
  await ensureSchema();

  if (req.method === "GET") {
    const result = await pool.query(
      `SELECT id, name FROM units WHERE active = true ORDER BY name`
    );
    return res.status(200).json(result.rows);
  }

  if (req.method === "POST") {
    const { name } = req.body || {};
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Nama unit wajib diisi" });
    }
    try {
      const result = await pool.query(
        `INSERT INTO units (name) VALUES ($1) RETURNING id, name`,
        [name.trim()]
      );
      return res.status(201).json(result.rows[0]);
    } catch (err) {
      if (err.code === "23505") {
        return res.status(409).json({ error: "Unit dengan nama itu sudah ada" });
      }
      throw err;
    }
  }

  if (req.method === "DELETE") {
    const { id } = req.body || {};
    await pool.query(`UPDATE units SET active = false WHERE id = $1`, [id]);
    return res.status(200).json({ ok: true });
  }

  res.setHeader("Allow", ["GET", "POST", "DELETE"]);
  return res.status(405).end();
}
