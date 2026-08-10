const { ensureSchema } = require("../../lib/db");
const { getUserFromReq } = require("../../lib/auth");
const { getShiftRangeStats, getDayRangeStats } = require("../../lib/dashboard");

export default async function handler(req, res) {
  try {
    await ensureSchema();
    const user = await getUserFromReq(req);
    if (!user) return res.status(401).json({ error: "Belum login" });
    if (user.role !== "admin") {
      return res.status(403).json({ error: "Dashboard hanya untuk admin" });
    }

    if (req.method !== "GET") {
      res.setHeader("Allow", ["GET"]);
      return res.status(405).end();
    }

    const range = req.query.range === "shift" ? "shift" : "day";
    const limit = Math.min(parseInt(req.query.limit, 10) || (range === "shift" ? 10 : 7), 60);

    const stats = range === "shift"
      ? await getShiftRangeStats(limit)
      : await getDayRangeStats(limit);

    return res.status(200).json({ range, limit, ...stats });
  } catch (err) {
    console.error("Error di /api/dashboard:", err);
    return res.status(500).json({ error: err.message });
  }
}
