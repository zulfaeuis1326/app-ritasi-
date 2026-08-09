// Offset UTC tetap untuk zona waktu Indonesia (tidak ada DST, jadi aman dihardcode).
const OFFSETS = {
  "Asia/Jakarta": 7,   // WIB
  "Asia/Makassar": 8,  // WITA
  "Asia/Jayapura": 9,  // WIT
};

const TZ_NAME = process.env.TZ_NAME || "Asia/Jakarta";
const OFFSET_HOURS = OFFSETS[TZ_NAME] ?? 7;

const BULAN_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

// Hitung waktu lokal tambang secara manual (offset tetap dari UTC), tidak bergantung
// pada database timezone (ICU) server — karena environment container kadang tidak
// punya data zona lengkap, sementara offset WIB/WITA/WIT sendiri tidak pernah berubah.
function nowParts() {
  const utcMs = Date.now();
  const local = new Date(utcMs + OFFSET_HOURS * 60 * 60 * 1000);
  return {
    hour: local.getUTCHours(),
    year: local.getUTCFullYear(),
    month: local.getUTCMonth() + 1, // 1-12
    day: local.getUTCDate(),
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

module.exports = { TZ_NAME, nowParts, currentShiftType, formatTanggalID, buildShiftLabel };
