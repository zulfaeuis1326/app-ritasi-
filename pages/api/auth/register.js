const { pool, ensureSchema } = require("../../../lib/db");
const { hashPassword, createSessionForUser } = require("../../../lib/auth");

export default async function handler(req, res) {
  try {
    await ensureSchema();

    if (req.method !== "POST") {
      res.setHeader("Allow", ["POST"]);
      return res.status(405).end();
    }

    const { username, password } = req.body || {};
    if (!username || !username.trim() || !password || password.length < 4) {
      return res.status(400).json({
        error: "Username wajib diisi dan password minimal 4 karakter",
      });
    }

    const countRes = await pool.query(`SELECT COUNT(*)::int AS total FROM users`);
    const role = countRes.rows[0].total === 0 ? "admin" : "operator";

    let inserted;
    try {
      inserted = await pool.query(
        `INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)
         RETURNING id, username, role`,
        [username.trim(), hashPassword(password), role]
      );
    } catch (err) {
      if (err.code === "23505") {
        return res.status(409).json({ error: "Username sudah dipakai, coba yang lain" });
      }
      throw err;
    }

    const user = inserted.rows[0];
    await createSessionForUser(res, user);
    return res.status(201).json({ user });
  } catch (err) {
    console.error("Error di /api/auth/register:", err);
    return res.status(500).json({ error: err.message });
  }
}
