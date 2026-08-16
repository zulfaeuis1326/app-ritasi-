import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import { atLeast } from "../../lib/roles";

export default function KelolaFleet() {
  const router = useRouter();
  const [authUser, setAuthUser] = useState(undefined);
  const [fleets, setFleets] = useState([]);
  const [units, setUnits] = useState([]);
  const [pits, setPits] = useState([]);
  const [error, setError] = useState(null);

  const [newFleetName, setNewFleetName] = useState("");
  const [newFleetPit, setNewFleetPit] = useState("");
  const [newPitName, setNewPitName] = useState("");
  const [unitSearch, setUnitSearch] = useState("");
  const [unitPitFilter, setUnitPitFilter] = useState("");
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [selectedFleetId, setSelectedFleetId] = useState("");

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((res) => res.json())
      .then((d) => {
        if (!d.user) router.push("/login");
        else if (!atLeast(d.user.role, "pengawas")) router.push("/");
        else setAuthUser(d.user);
      })
      .catch(() => router.push("/login"));
  }, [router]);

  const loadAll = useCallback(async () => {
    try {
      const [fRes, uRes, pRes] = await Promise.all([
        fetch("/api/fleets"),
        fetch("/api/units"),
        fetch("/api/pits"),
      ]);
      if (fRes.ok) setFleets(await fRes.json());
      if (uRes.ok) setUnits(await uRes.json());
      if (pRes.ok) setPits(await pRes.json());
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    if (authUser) loadAll();
  }, [authUser, loadAll]);

  async function handleAddFleet(e) {
    e.preventDefault();
    if (!newFleetName.trim()) return;
    try {
      const res = await fetch("/api/fleets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newFleetName.trim(), pitId: newFleetPit || null }),
      });
      if (res.ok) {
        setNewFleetName("");
        setNewFleetPit("");
        await loadAll();
      } else {
        const d = await res.json().catch(() => ({}));
        alert(`Gagal tambah PC: ${d.error || res.status}`);
      }
    } catch (err) {
      alert(`Gagal tambah PC (koneksi/server bermasalah): ${err.message}`);
    }
  }

  async function handleDeleteFleet(id, name) {
    if (!confirm(`Hapus PC "${name}"? Semua HD yang gabung di sini akan dilepas (jadi belum di-assign).`)) return;
    try {
      const res = await fetch("/api/fleets", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) await loadAll();
      else {
        const d = await res.json().catch(() => ({}));
        alert(`Gagal hapus: ${d.error || res.status}`);
      }
    } catch (err) {
      alert(`Gagal hapus (koneksi/server bermasalah): ${err.message}`);
    }
  }

  async function handleSetFleetPit(fleetId, pitId) {
    try {
      const res = await fetch("/api/fleets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_pit", fleetId, pitId: pitId || null }),
      });
      if (res.ok) await loadAll();
      else {
        const d = await res.json().catch(() => ({}));
        alert(`Gagal ubah PIT: ${d.error || res.status}`);
      }
    } catch (err) {
      alert(`Gagal ubah PIT (koneksi/server bermasalah): ${err.message}`);
    }
  }

  async function handleAssignFleet(unitId, fleetId) {
    try {
      const res = await fetch("/api/units", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "assign_fleet", unitId, fleetId: fleetId || null }),
      });
      if (res.ok) await loadAll();
      else {
        const d = await res.json().catch(() => ({}));
        alert(`Gagal assign fleet: ${d.error || res.status}`);
      }
    } catch (err) {
      alert(`Gagal assign fleet (koneksi/server bermasalah): ${err.message}`);
    }
  }

  async function handleSetUnitPit(unitId, pitId) {
    try {
      const res = await fetch("/api/units", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_pit", unitId, pitId: pitId || null }),
      });
      if (res.ok) await loadAll();
      else {
        const d = await res.json().catch(() => ({}));
        alert(`Gagal ubah PIT: ${d.error || res.status}`);
      }
    } catch (err) {
      alert(`Gagal ubah PIT (koneksi/server bermasalah): ${err.message}`);
    }
  }

  async function handleAddPit(e) {
    e.preventDefault();
    if (!newPitName.trim()) return;
    try {
      const res = await fetch("/api/pits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newPitName.trim() }),
      });
      if (res.ok) {
        setNewPitName("");
        await loadAll();
      } else {
        const d = await res.json().catch(() => ({}));
        alert(`Gagal tambah lokasi: ${d.error || res.status}`);
      }
    } catch (err) {
      alert(`Gagal tambah lokasi (koneksi/server bermasalah): ${err.message}`);
    }
  }

  const filteredUnits = units.filter((u) => {
    const matchSearch = !unitSearch.trim() || u.name.toLowerCase().includes(unitSearch.trim().toLowerCase());
    const matchPit = !unitPitFilter || String(u.pit_id) === unitPitFilter;
    return matchSearch && matchPit;
  });
  const selectedUnit = units.find((u) => String(u.id) === selectedUnitId) || null;
  const selectedFleet = fleets.find((f) => String(f.id) === selectedFleetId) || null;
  const selectedFleetMembers = selectedFleet ? units.filter((u) => u.fleet_id === selectedFleet.id) : [];

  if (authUser === undefined || authUser === null) {
    return (
      <div className="container">
        <div className="card"><div className="hint">Memuat...</div></div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="card header-card">
        <div className="clock" style={{ fontSize: 22 }}>Kelola Fleet</div>
        <a href="/" className="hint" style={{ display: "block", textAlign: "center", marginTop: 6 }}>
          ← Kembali ke Monitoring
        </a>
      </div>

      {error && (
        <div className="card"><div className="hint" style={{ color: "var(--danger)" }}>Error: {error}</div></div>
      )}

      <div className="card">
        <div className="section-title">Tambah Lokasi PIT</div>
        <form onSubmit={handleAddPit} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input
            value={newPitName}
            onChange={(e) => setNewPitName(e.target.value)}
            placeholder="Contoh: PIT BARU"
            style={{ flex: 1 }}
          />
          <button className="btn btn-secondary" style={{ width: "auto", padding: "0 16px" }}>
            Tambah
          </button>
        </form>
        <div className="hint">Lokasi yang ada: {pits.map((p) => p.name).join(", ") || "belum ada"}</div>
      </div>

      <div className="card">
        <div className="section-title">Tambah PC / Loader (Fleet Baru)</div>
        <form onSubmit={handleAddFleet} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input
            value={newFleetName}
            onChange={(e) => setNewFleetName(e.target.value)}
            placeholder="Contoh: E52099"
          />
          <select value={newFleetPit} onChange={(e) => setNewFleetPit(e.target.value)}>
            <option value="">-- Tanpa PIT dulu --</option>
            {pits.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button className="btn btn-secondary" style={{ width: "auto", padding: "0 16px" }}>
            Tambah PC
          </button>
        </form>
      </div>

      <div className="card">
        <div className="section-title">Daftar Fleet (PC/Loader)</div>
        <select
          value={selectedFleetId}
          onChange={(e) => setSelectedFleetId(e.target.value)}
          style={{ marginBottom: 10 }}
        >
          <option value="">-- Pilih PC/fleet --</option>
          {fleets.map((f) => (
            <option key={f.id} value={f.id}>{f.name} {f.pit_name ? `(${f.pit_name})` : ""}</option>
          ))}
        </select>

        {selectedFleet && (
          <div style={{ padding: 10, background: "var(--surface-alt)", borderRadius: 8, marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <b>{selectedFleet.name}</b>
              <button className="btn-mini-danger" onClick={() => handleDeleteFleet(selectedFleet.id, selectedFleet.name)}>Hapus</button>
            </div>
            <div className="field-label" style={{ marginBottom: 4 }}>PIT</div>
            <select
              value={selectedFleet.pit_id || ""}
              onChange={(e) => handleSetFleetPit(selectedFleet.id, e.target.value)}
              style={{ marginBottom: 8 }}
            >
              <option value="">-- Belum ada PIT --</option>
              {pits.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <div className="hint">
              HD gabung ({selectedFleetMembers.length}): {selectedFleetMembers.length ? selectedFleetMembers.map((m) => m.name).join(", ") : "belum ada"}
            </div>
          </div>
        )}

        <div className="section-title" style={{ marginTop: 4 }}>Ringkasan ({fleets.length} PC)</div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr><th>PC</th><th>PIT</th><th>Jml HD</th></tr>
            </thead>
            <tbody>
              {fleets.map((f) => (
                <tr key={f.id}>
                  <td>{f.name}</td>
                  <td>{f.pit_name || "-"}</td>
                  <td>{units.filter((u) => u.fleet_id === f.id).length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {fleets.length === 0 && <div className="hint">Belum ada PC/fleet.</div>}
      </div>

      <div className="card">
        <div className="section-title">Assign HD ke Fleet</div>
        <div className="hint" style={{ marginBottom: 8 }}>
          Cari unit, pilih dari dropdown, baru atur fleet & PIT-nya — biar gak scroll list panjang.
        </div>
        <input
          value={unitSearch}
          onChange={(e) => setUnitSearch(e.target.value)}
          placeholder="Ketik nomor unit, misal H572..."
          style={{ marginBottom: 8 }}
        />
        <select
          value={unitPitFilter}
          onChange={(e) => setUnitPitFilter(e.target.value)}
          style={{ marginBottom: 8 }}
        >
          <option value="">-- Semua PIT --</option>
          {pits.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select
          value={selectedUnitId}
          onChange={(e) => setSelectedUnitId(e.target.value)}
          style={{ marginBottom: 10 }}
        >
          <option value="">-- Pilih unit --</option>
          {filteredUnits.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} {u.fleet_name ? `(fleet: ${u.fleet_name})` : "(belum ada fleet)"}
            </option>
          ))}
        </select>

        {selectedUnit && (
          <div style={{ padding: 10, background: "var(--surface-alt)", borderRadius: 8, marginBottom: 10 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>{selectedUnit.name}</div>
            <div className="field-label" style={{ marginBottom: 4 }}>Fleet (PC)</div>
            <select
              value={selectedUnit.fleet_id || ""}
              onChange={(e) => handleAssignFleet(selectedUnit.id, e.target.value)}
              style={{ marginBottom: 10 }}
            >
              <option value="">-- Belum gabung fleet --</option>
              {fleets.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
            <div className="field-label" style={{ marginBottom: 4 }}>PIT</div>
            <select
              value={selectedUnit.pit_id || ""}
              onChange={(e) => handleSetUnitPit(selectedUnit.id, e.target.value)}
            >
              <option value="">-- Belum ada PIT --</option>
              {pits.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="section-title" style={{ marginTop: 4 }}>
          Ringkasan Semua Unit ({filteredUnits.length}/{units.length})
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr><th>Unit</th><th>Fleet</th><th>PIT</th></tr>
            </thead>
            <tbody>
              {filteredUnits.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.fleet_name || "-"}</td>
                  <td>{u.pit_name || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {units.length === 0 && <div className="hint">Belum ada unit HD.</div>}
      </div>

      <div className="app-footer">designed by Najib.dev</div>
    </div>
  );
              }
          
