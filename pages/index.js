import { useEffect, useState, useCallback } from "react";

const MATERIALS = ["OB", "COAL", "SOIL", "SOLU", "MUD"];

function formatJamCell(h) {
  if (!h || h.total === 0) return "-";
  const entries = Object.entries(h.materials);
  if (entries.length === 1) return `${h.total} (${entries[0][0]})`;
  return `${h.total} (${entries.map(([m, n]) => `${m}:${n}`).join(", ")})`;
}

export default function Home() {
  const [clock, setClock] = useState("");
  const [units, setUnits] = useState([]);
  const [selectedUnit, setSelectedUnit] = useState("");
  const [material, setMaterial] = useState("");
  const [recap, setRecap] = useState(null);
  const [newUnitName, setNewUnitName] = useState("");
  const [loadingClick, setLoadingClick] = useState(false);
  const [closing, setClosing] = useState(false);
  const [pastShifts, setPastShifts] = useState([]);

  const loadUnits = useCallback(async () => {
    const res = await fetch("/api/units");
    const data = await res.json();
    setUnits(data);
    if (!selectedUnit && data.length > 0) setSelectedUnit(String(data[0].id));
  }, [selectedUnit]);

  const loadRecap = useCallback(async () => {
    const res = await fetch("/api/ritasi");
    const data = await res.json();
    setRecap(data);
  }, []);

  const loadPastShifts = useCallback(async () => {
    const res = await fetch("/api/shift/list");
    const data = await res.json();
    setPastShifts(data.filter((s) => s.status === "closed"));
  }, []);

  useEffect(() => {
    loadUnits();
    loadRecap();
    loadPastShifts();
    const poll = setInterval(loadRecap, 5000);
    return () => clearInterval(poll);
  }, [loadUnits, loadRecap, loadPastShifts]);

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString("id-ID"));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  async function handleClick() {
    if (!selectedUnit || !material) return;
    setLoadingClick(true);
    try {
      const res = await fetch("/api/ritasi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitId: Number(selectedUnit), material }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(`Gagal mencatat ritasi: ${data.error || res.status}`);
        return;
      }
      const data = await res.json();
      setRecap(data);
    } catch (err) {
      alert(`Gagal mencatat ritasi (koneksi/server bermasalah): ${err.message}`);
    } finally {
      setLoadingClick(false);
    }
  }

  async function handleAddUnit(e) {
    e.preventDefault();
    if (!newUnitName.trim()) return;
    try {
      const res = await fetch("/api/units", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newUnitName.trim() }),
      });
      if (res.ok) {
        setNewUnitName("");
        await loadUnits();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(`Gagal menambah unit: ${data.error || res.status}`);
      }
    } catch (err) {
      alert(`Gagal menambah unit (koneksi/server bermasalah): ${err.message}`);
    }
  }

  async function handleCloseShift() {
    if (!confirm("Yakin tutup shift sekarang? Data shift ini akan dikunci.")) return;
    setClosing(true);
    try {
      const res = await fetch("/api/shift/close", { method: "POST" });
      const data = await res.json();
      await loadRecap();
      await loadPastShifts();
      window.open(`/api/shift/export?shiftId=${data.closedShiftId}`, "_blank");
    } finally {
      setClosing(false);
    }
  }

  const selectedUnitRecap = recap?.units?.find((u) => String(u.id) === selectedUnit);
  const currentHourData = selectedUnitRecap?.hourly?.find((h) => h.jam === recap?.currentHour);

  return (
    <div className="container">
      <div className="card">
        <div className="clock">{clock}</div>
        <div className="shift-label">{recap?.shift?.label || "Memuat shift..."}</div>
      </div>

      <div className="card">
        <div className="section-title">Unit</div>
        <select value={selectedUnit} onChange={(e) => setSelectedUnit(e.target.value)}>
          {units.length === 0 && <option value="">Belum ada unit</option>}
          {units.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>

        <div className="section-title">Material aktif</div>
        <div className="material-grid">
          {MATERIALS.map((m) => (
            <button
              key={m}
              className={`material-btn ${material === m ? "active" : ""}`}
              onClick={() => setMaterial(m)}
            >
              {m}
            </button>
          ))}
        </div>

        <button
          className="big-click-btn"
          disabled={!selectedUnit || !material || loadingClick}
          onClick={handleClick}
        >
          {loadingClick ? "..." : "+ RITASI"}
        </button>

        <div className="stat-row">
          <span>Ritasi jam ini ({recap?.currentHour ?? "-"})</span>
          <b>{currentHourData?.total ?? 0}</b>
        </div>
        <div className="stat-row">
          <span>Total shift ini</span>
          <b>{selectedUnitRecap?.total ?? 0}</b>
        </div>
        {!material && <div className="hint">Pilih material dulu sebelum klik ritasi.</div>}
      </div>

      <div className="card">
        <div className="section-title">Tambah Unit</div>
        <form onSubmit={handleAddUnit} style={{ display: "flex", gap: 8 }}>
          <input
            value={newUnitName}
            onChange={(e) => setNewUnitName(e.target.value)}
            placeholder="Contoh: HD-05"
            style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #d1d5db" }}
          />
          <button className="btn btn-secondary" style={{ width: "auto", padding: "0 16px" }}>
            Tambah
          </button>
        </form>
      </div>

      <div className="card">
        <div className="section-title">Rekap Per Jam — Shift Berjalan</div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Unit</th>
                {recap?.hours?.map((h) => (
                  <th key={h}>{String(h).padStart(2, "0")}</th>
                ))}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {recap?.units?.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 700 }}>{u.name}</td>
                  {u.hourly.map((h) => (
                    <td key={h.jam}>{formatJamCell(h)}</td>
                  ))}
                  <td style={{ fontWeight: 700 }}>{u.total}</td>
                </tr>
              ))}
              {recap && (
                <tr className="total-row">
                  <td>TOTAL</td>
                  {recap.grandHourlyTotals?.map((v, i) => (
                    <td key={i}>{v}</td>
                  ))}
                  <td>{recap.grandTotal}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="section-title">Rincian Material</div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Unit</th>
                <th>Total</th>
                {MATERIALS.map((m) => (
                  <th key={m}>{m}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recap?.units?.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 700 }}>{u.name}</td>
                  <td>{u.total}</td>
                  {MATERIALS.map((m) => (
                    <td key={m}>{u.materialTotals?.[m] || 0}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <button className="btn btn-danger" onClick={handleCloseShift} disabled={closing}>
          {closing ? "Menutup shift..." : "Tutup Shift & Export Excel"}
        </button>
        <div className="hint">Data shift dikunci setelah ditutup. File Excel otomatis terunduh.</div>
      </div>

      {pastShifts.length > 0 && (
        <div className="card">
          <div className="section-title">Riwayat Shift</div>
          {pastShifts.map((s) => (
            <div key={s.id} className="stat-row">
              <span>{s.label}</span>
              <a href={`/api/shift/export?shiftId=${s.id}`} target="_blank" rel="noreferrer">
                Download
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
                                 }
