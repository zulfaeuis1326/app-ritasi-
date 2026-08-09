const { pool } = require("./db");
const { MATERIALS } = require("./materials");

// Urutan jam standar untuk tiap tipe shift, dipakai sebagai kolom tabel.
function hourSequence(shiftType) {
  if (shiftType === 1) {
    // Shift 1: 07:00 - 18:59 -> kolom jam 7..18
    return Array.from({ length: 12 }, (_, i) => i + 7);
  }
  // Shift 2 (malam): 19:00 - 06:59 -> kolom jam 19..23, 0..6
  return [19, 20, 21, 22, 23, 0, 1, 2, 3, 4, 5, 6];
}

// Ambil rekap lengkap satu shift: per unit x per jam (dengan rincian material),
// plus rincian total material per unit, plus grand total.
async function buildRecap(shiftId) {
  const shiftRes = await pool.query(`SELECT * FROM shifts WHERE id = $1`, [shiftId]);
  if (shiftRes.rows.length === 0) return null;
  const shift = shiftRes.rows[0];

  const unitsRes = await pool.query(`SELECT * FROM units WHERE active = true ORDER BY name`);
  const clicksRes = await pool.query(
    `SELECT unit_id, jam, material, COUNT(*)::int AS jumlah
     FROM ritasi_clicks
     WHERE shift_id = $1
     GROUP BY unit_id, jam, material`,
    [shiftId]
  );

  const hours = hourSequence(shift.shift_type);

  // index: unitId -> jam -> material -> jumlah
  const index = {};
  for (const row of clicksRes.rows) {
    index[row.unit_id] ??= {};
    index[row.unit_id][row.jam] ??= {};
    index[row.unit_id][row.jam][row.material] = row.jumlah;
  }

  const units = unitsRes.rows.map((u) => {
    const hourly = hours.map((jam) => {
      const materialsAtHour = index[u.id]?.[jam] || {};
      const total = Object.values(materialsAtHour).reduce((a, b) => a + b, 0);
      return { jam, total, materials: materialsAtHour };
    });

    const materialTotals = Object.fromEntries(MATERIALS.map((m) => [m, 0]));
    let unitTotal = 0;
    for (const h of hourly) {
      for (const [mat, jumlah] of Object.entries(h.materials)) {
        materialTotals[mat] = (materialTotals[mat] || 0) + jumlah;
        unitTotal += jumlah;
      }
    }

    return { id: u.id, name: u.name, hourly, materialTotals, total: unitTotal };
  });

  const grandTotal = units.reduce((a, u) => a + u.total, 0);
  const grandMaterialTotals = Object.fromEntries(MATERIALS.map((m) => [m, 0]));
  for (const u of units) {
    for (const m of MATERIALS) grandMaterialTotals[m] += u.materialTotals[m];
  }
  const grandHourlyTotals = hours.map((jam, i) =>
    units.reduce((a, u) => a + u.hourly[i].total, 0)
  );

  return { shift, hours, units, grandTotal, grandMaterialTotals, grandHourlyTotals };
}

module.exports = { buildRecap, hourSequence };
