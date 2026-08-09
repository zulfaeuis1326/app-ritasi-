const { pool, ensureSchema } = require("../../lib/db");
const { getOrCreateOpenShift } = require("../../lib/shift");
const { buildRecap } = require("../../lib/recap");
const { nowParts } = require("../../lib/time");
const { MATERIALS } = require("../../lib/materials");

export default async function handler(req, res) {
  await ensureSchema();

  if (req.method === "POST") {
    const { unitId, material } = req.body || {};
    if (!unitId || !MATERIALS.includes(material)) {
      return res.status(400).json({ error: "unitId dan material (valid) wajib diisi" });
    }

    const shift = await getOrCreateOpenShift();
    const jam = nowParts().hour;

    await pool.query(
      `INSERT INTO ritasi_clicks (unit_id, shift_id, material, jam) VALUES ($1, $2, $3, $4)`,
      [unitId, shift.id, material, jam]
    );

    const recap = await buildRecap(shift.id);
    return res.status(201).json({ currentHour: jam, ...recap });
  }

  if (req.method === "GET") {
    const shift = await getOrCreateOpenShift();
    const recap = await buildRecap(shift.id);
    return res.status(200).json({ currentHour: nowParts().hour, ...recap });
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).end();
}
