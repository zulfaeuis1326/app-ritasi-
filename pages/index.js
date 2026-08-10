import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";

const MATERIALS = ["OB", "COAL", "SOIL", "SOLU", "MUD"];

function formatJamCell(h) {
  if (!h || h.total === 0) return "-";
  const entries = Object.entries(h.materials);
  if (entries.length === 1) return `${h.total} (${entries[0][0]})`;
  return `${h.total} (${entries.map(([m, n]) => `${m}:${n}`).join(", ")})`;
}

export default function Home() {
  const router = useRouter();
  const [authUser, setAuthUser] = useState(undefined); // undefined = belum dicek, null = belum login
  const [clock, setClock] = useState("");
  const [units, setUnits] = useState([]);
  const [selectedUnit, setSelectedUnit] = useState("");
  const [material, setMaterial] = useState("");
  const [recap, setRecap] = useState(null);
  const [recapError, setRecapError] = useState(null);
  const [newUnitName, setNewUnitName] = useState("");
  const [loadingClick, setLoadingClick] = useState(false);
  const [closing, setClosing] = useState(false);
  const [pastShifts, setPastShifts] = useState([]);
  const [history, setHistory] = useState([]);
  const [logoFailed, setLogoFailed] = useState(false);
  const [cacheBuster] = useState(() => Date.now());

  const loadUnits = useCallback(async () => {
    const res = await fetch("/api/units");
    const data = await res.json();
    setUnits(data);
  }, []);

  const loadRecap = useCallback(async () => {
    try {
      const res = await fetch("/api/ritasi");
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setRecapError(data.error || `Error ${res.status}`);
        return;
      }
      const data = await res.json();
      setRecap(data);
      setRecapError(null);
    } catch (err) {
      setRecapError(err.message);
    }
  }, [router]);

  const loadPastShifts = useCallback(async () => {
    const res = await fetch("/api/shift/list");
    const data = await res.json();
    setPastShifts(data.filter((s) => s.status === "closed"));
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/ritasi/history");
      if (!res.ok) return;
      const data = await res.json();
      setHistory(data.clicks || []);
    } catch (err) {
      // diamkan — bukan bagian kritis, tidak perlu ganggu tampilan utama
    }
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (!data.user) {
          router.push("/login");
        } else {
          setAuthUser(data.user);
        }
      })
      .catch(() => router.push("/login"));
  }, [router]);

  useEffect(() => {
    if (!authUser) return;
    loadUnits();
    loadRecap();
    loadPastShifts();
    loadHistory();
    const poll = setInterval(() => {
      loadRecap();
      loadHistory();
    }, 5000);
    return () => clearInterval(poll);
  }, [authUser, loadUnits, loadRecap, loadPastShifts, loadHistory]);

  // Selalu pastikan selectedUnit valid — kalau unit yang dipilih sudah dihapus,
  // atau belum ada yang dipilih sama sekali, otomatis pindah ke unit pertama.
  // Ini mencegah tombol +RITASI "diam" karena selectedUnit nyasar ke unit yang tidak ada lagi.
  useEffect(() => {
    if (units.length === 0) {
      if (selectedUnit !== "") setSelectedUnit("");
      return;
    }
    const stillValid = units.some((u) => String(u.id) === selectedUnit);
    if (!stillValid) setSelectedUnit(String(units[0].id));
  }, [units, selectedUnit]);

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString("id-ID"));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  async function handleClick() {
    if (!selectedUnit) {
      alert("Pilih unit dulu.");
      return;
    }
    if (!material) {
      alert("Pilih material dulu.");
      return;
    }
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
      loadHistory();
    } catch (err) {
      alert(`Gagal mencatat ritasi (koneksi/server bermasalah): ${err.message}`);
    } finally {
      setLoadingClick(false);
    }
  }

  async function handleDeleteClick(clickId) {
    if (!confirm("Hapus entri ritasi ini? Aksi ini untuk koreksi klik yang salah.")) return;
    try {
      const res = await fetch("/api/ritasi/history", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: clickId }),
      });
      if (res.ok) {
        await loadRecap();
        await loadHistory();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(`Gagal menghapus entri: ${data.error || res.status}`);
      }
    } catch (err) {
      alert(`Gagal menghapus entri (koneksi/server bermasalah): ${err.message}`);
    }
  }

  async function handleDeleteUnit(unitId) {
    const unit = units.find((u) => String(u.id) === String(unitId));
    if (!confirm(`Hapus unit "${unit?.name}"? Riwayat ritasi unit ini di shift-shift sebelumnya tetap tersimpan, tapi unit ini tidak akan muncul lagi untuk input baru.`)) {
      return;
    }
    try {
      const res = await fetch("/api/units", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: Number(unitId) }),
      });
      if (res.ok) {
        setSelectedUnit("");
        await loadUnits();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(`Gagal menghapus unit: ${data.error || res.status}`);
      }
    } catch (err) {
      alert(`Gagal menghapus unit (koneksi/server bermasalah): ${err.message}`);
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

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
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

  if (authUser === undefined) {
    return (
      <div className="container">
        <div className="card"><div className="hint">Memuat...</div></div>
      </div>
    );
  }
  if (authUser === null) {
    return null; // sedang redirect ke /login
  }

  return (
    <div className="container">
      <div className="card header-card">
        <img
          src={`/logo.png?v=${cacheBuster}`}
          alt="Logo"
          className="app-logo"
          onError={(e) => { e.target.style.display = "none"; setLogoFailed(true); }}
          onLoad={() => setLogoFailed(false)}
        />
        {logoFailed && (
          <div className="hint" style={{ textAlign: "center", color: "#b91c1c" }}>
            Logo belum ditemukan di /logo.png — cek lagi file ada di folder public/ repo
          </div>
        )}
        <div className="clock">{clock}</div>
        <div className="shift-label">
          {recapError ? `Error: ${recapError}` : (recap?.shift?.label || "Memuat shift...")}
        </div>
        {recap?.tzInfo && <div className="hint" style={{ textAlign: "center" }}>Zona waktu server: {recap.tzInfo}</div>}
        <div className="stat-row" style={{ marginTop: 12 }}>
          <span>{authUser.username} ({authUser.role === "admin" ? "Admin" : "Operator"})</span>
          <button className="btn-mini-danger" onClick={handleLogout}>Logout</button>
        </div>
        {authUser.role === "admin" && (
          <a href="/dashboard" className="hint" style={{ display: "block", textAlign: "center", marginTop: 8 }}>
            📊 Buka Dashboard Analitik
          </a>
        )}
      </div>

      <div className="card">
        <div className="section-title">Unit</div>
        <select value={selectedUnit} onChange={(e) => setSelectedUnit(e.target.value)}>
          {units.length === 0 && <option value="">Belum ada unit</option>}
          {units.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
        {selectedUnit && authUser.role === "admin" && (
          <button
            className="btn"
            style={{ background: "#fff", color: "#b91c1c", border: "1px solid #b91c1c", marginBottom: 10 }}
            onClick={() => handleDeleteUnit(selectedUnit)}
          >
            Hapus Unit Ini
          </button>
        )}

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
        <div className="hint" style={{ marginBottom: 8 }}>
          Kolom jam <b>{String(recap?.currentHour ?? "").padStart(2, "0")}</b> (ditandai biru) adalah jam yang sedang berjalan saat ini.
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Unit</th>
                {recap?.hours?.map((h) => (
                  <th key={h} className={h === recap.currentHour ? "current-hour" : ""}>
                    {String(h).padStart(2, "0")}
                  </th>
                ))}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {recap?.units?.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 700 }}>{u.name}</td>
                  {u.hourly.map((h) => (
                    <td key={h.jam} className={h.jam === recap.currentHour ? "current-hour" : ""}>
                      {formatJamCell(h)}
                    </td>
                  ))}
                  <td style={{ fontWeight: 700 }}>{u.total}</td>
                </tr>
              ))}
              {recap && (
                <tr className="total-row">
                  <td>TOTAL</td>
                  {recap.grandHourlyTotals?.map((v, i) => (
                    <td key={i} className={recap.hours[i] === recap.currentHour ? "current-hour" : ""}>
                      {v}
                    </td>
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
        <div className="section-title">Riwayat & Revisi Ritasi</div>
        <div className="hint" style={{ marginBottom: 8 }}>
          Salah pencet unit/material? Hapus entri yang salah di sini, lalu klik ulang yang benar.
        </div>
        {history.length === 0 && <div className="hint">Belum ada klik ritasi di shift ini.</div>}
        {history.map((h) => (
          <div key={h.id} className="history-row">
            <div className="history-info">
              <b>{h.unit_name}</b> — {h.material} — jam {String(h.jam).padStart(2, "0")}
              <div className="hint">
                {h.operator_name || "(tanpa nama)"} · {new Date(h.clicked_at).toLocaleTimeString("id-ID")}
              </div>
            </div>
            {(authUser.role === "admin" || h.operator_id === authUser.id) && (
              <button className="btn-mini-danger" onClick={() => handleDeleteClick(h.id)}>
                Hapus
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="card">
        <button
          className="btn btn-secondary"
          onClick={() => window.open(`/api/shift/export?shiftId=${recap?.shift?.id}`, "_blank")}
          disabled={!recap?.shift?.id}
        >
          Export Excel (Preview)
        </button>
        <div className="hint">Download rekap sejauh ini tanpa mengunci shift — bisa dipakai kapan saja, berkali-kali.</div>
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
