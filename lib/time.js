const TZ = process.env.TZ_NAME || "Asia/Jakarta";

const BULAN_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

// Ambil komponen waktu (jam, hari, dst) sesuai timezone tambang, bukan timezone server.
function nowParts() {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour: "numeric",
    hour12: false,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map(p => [p.type, p.value]));
  let hour = parseInt(parts.hour, 10);
  if (hour === 24) hour = 0;
  return {
    hour,
    year: parseInt(parts.year, 10),
    month: parseInt(parts.month, 10), // 1-12
    day: parseInt(parts.day, 10),
  };
}

// Shift 1: 07:00–18:59, Shift 2 (malam): 19:00–06:59
function currentShiftType(hour) {
  return hour >= 7 && hour < 19 ? 1 : 2;
}

function formatTanggalID({ year, month, day }) {
  return `${day} ${BULAN_ID[month - 1]} ${year}`;
}

function buildShiftLabel() {
  const p = nowParts();
  const type = currentShiftType(p.hour);
  return {
    shiftType: type,
    label: `Shift ${type} - ${formatTanggalID(p)}`,
  };
}

module.exports = { TZ, nowParts, currentShiftType, formatTanggalID, buildShiftLabel };
