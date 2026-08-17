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

  const [search, setSearch] = useState("");
  const [selectedUnitId, setSelectedUnitId] = useState("");

  const [showAddPit, setShowAddPit] = useState(false);
  const [showAddPc, setShowAddPc] = useState(false);
  const [newPitName, setNewPitName] = useState("");
  const [newFleetName, setNewFleetName] = useState("");
  const [newFleetPit, setNewFleetPit] = useState("");

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
        setShowAddPit(false);
        await loadAll();
      } else {
        const d = await res.json().catch(() => ({}));
        alert(`Gagal tambah lokasi: ${d.error || res.status}`);
      }
    } catch (err) {
      alert(`Gagal tambah lokasi (koneksi/server bermasalah): ${err.message}`);
    }
  }

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
        setShowAddPc(false);
        await loadAll();
      } else {
        const d = await res.json().catch(() => ({}));
        alert(`Gagal tambah PC: ${d.error || res.status}`);
      }
    } catch (err) {
      alert(`Gagal tambah PC (koneksi/server bermasalah): ${err.message}`);
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
        alert(`Gagal assign PC: ${d.error || res.status}`);
      }
    } catch (err) {
      alert(`Gagal assign PC (koneksi/server bermasalah): ${err.message}`);
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
        alert(`Gagal ubah lokasi: ${d.error || res.status}`);
      }
    } catch (err) {
      alert(`Gagal ubah lokasi (koneksi/server bermasalah): ${err.message}`);
    }
  }

  if (authUser === undefined || authUser === null) {
    return (
      <div className="container">
        <div className="card"><div className="hint">Memuat...</div></div>
      </div>
    );
  }

  // Cuma unit HD yang dicocokin ke search (PC diatur lewat form tambah/pilih terpisah di bawah).
  const filteredUnits = search.trim()
    ? units.filter((u) => u.name.toLowerCase().includes(search.trim().toLowerCase()))
    : units;
  const selectedUnit = units.find((u) => String(u.id) === selectedUnitId) || null;

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
        <div className="section-title">Unit Hauler → Masuk PC Berapa, Lokasi Mana</div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari unit, misal H572..."
          style={{ marginBottom: 8 }}
        />
        <select
          value={selectedUnitId}
          onChange={(e) => setSelectedUnitId(e.target.value)}
        >
          <option value="">-- Pilih unit HD --</option>
          {filteredUnits.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} {u.fleet_name ? `→ ${u.fleet_name}` : ""} {u.pit_name ? `(${u.pit_name})` : ""}
            </option>
          ))}
        </select>

        {selectedUnit && (
          <div style={{ padding: 10, background: "var(--surface-alt)", borderRadius: 8, marginTop: 10 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>{selectedUnit.name}</div>

            <div className="field-label" style={{ marginBottom: 4 }}>Masuk PC (Fleet)</div>
            <select
              value={selectedUnit.fleet_id || ""}
              onChange={(e) => handleAssignFleet(selectedUnit.id, e.target.value)}
              style={{ marginBottom: 10 }}
            >
              <option value="">-- Belum gabung PC --</option>
              {fleets.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>

            <div className="field-label" style={{ marginBottom: 4 }}>Lokasi (PIT)</div>
            <select
              value={selectedUnit.pit_id || ""}
              onChange={(e) => handleSetUnitPit(selectedUnit.id, e.target.value)}
            >
              <option value="">-- Belum ada lokasi --</option>
              {pits.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="card">
        <button
          className="btn btn-secondary"
          style={{ marginBottom: showAddPc ? 10 : 0 }}
          onClick={() => setShowAddPc(!showAddPc)}
        >
          {showAddPc ? "Batal" : "+ Tambah PC / Loader Baru"}
        </button>
        {showAddPc && (
          <form onSubmit={handleAddFleet} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input
              value={newFleetName}
              onChange={(e) => setNewFleetName(e.target.value)}
              placeholder="Contoh: E52099"
            />
            <select value={newFleetPit} onChange={(e) => setNewFleetPit(e.target.value)}>
              <option value="">-- Tanpa lokasi dulu --</option>
              {pits.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <button className="btn btn-secondary" style={{ width: "auto", padding: "0 16px" }}>
              Simpan
            </button>
          </form>
        )}
      </div>

      <div className="card">
        <button
          className="btn btn-secondary"
          style={{ marginBottom: showAddPit ? 10 : 0 }}
          onClick={() => setShowAddPit(!showAddPit)}
        >
          {showAddPit ? "Batal" : "+ Tambah Lokasi Baru"}
        </button>
        {showAddPit && (
          <form onSubmit={handleAddPit} style={{ display: "flex", gap: 8 }}>
            <input
              value={newPitName}
              onChange={(e) => setNewPitName(e.target.value)}
              placeholder="Contoh: PIT BARU"
              style={{ flex: 1 }}
            />
            <button className="btn btn-secondary" style={{ width: "auto", padding: "0 16px" }}>
              Simpan
            </button>
          </form>
        )}
      </div>

      <div className="app-footer">designed by Najib.dev</div>
    </div>
  );
          }
                
