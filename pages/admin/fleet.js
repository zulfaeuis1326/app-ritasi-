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
  const [selectedKey, setSelectedKey] = useState("");

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

  async function handleDeleteFleet(id, name) {
    if (!confirm(`Hapus PC "${name}"? Semua HD yang gabung di sini akan dilepas (jadi belum di-assign).`)) return;
    try {
      const res = await fetch("/api/fleets", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setSelectedKey("");
        await loadAll();
      } else {
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
        alert(`Gagal ubah PIT: ${d.error || res.status}`);
      }
    } catch (err) {
      alert(`Gagal ubah PIT (koneksi/server bermasalah): ${err.message}`);
    }
  }

  if (authUser === undefined || authUser === null) {
    return (
      <div className="container">
        <div className="card"><div className="hint">Memuat...</div></div>
      </div>
    );
  }

  // Gabungin PC (fleet) & HD (unit) jadi 1 daftar biar search & tabelnya satu tempat aja.
  const rows = [
    ...fleets.map((f) => ({
      key: "pc-" + f.id,
      type: "PC",
      id: f.id,
      name: f.name,
      pit_id: f.pit_id,
      pit_name: f.pit_name,
      pc_name: null,
      memberCount: units.filter((u) => u.fleet_id === f.id).length,
    })),
    ...units.map((u) => ({
      key: "hd-" + u.id,
      type: "HD",
      id: u.id,
      name: u.name,
      pit_id: u.pit_id,
      pit_name: u.pit_name,
      pc_name: u.fleet_name,
      fleet_id: u.fleet_id,
    })),
  ];

  const filteredRows = search.trim()
    ? rows.filter((r) => r.name.toLowerCase().includes(search.trim().toLowerCase()))
    : rows;

  const selected = rows.find((r) => r.key === selectedKey) || null;

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
        <div className="section-title">Cari Unit (PC atau HD)</div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Ketik nomor unit, misal H572 atau E520..."
        />
      </div>

      {selected && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div>
              <span className={selected.type === "PC" ? "badge badge-pc" : "badge badge-hd"}>{selected.type}</span>
              <b style={{ marginLeft: 8, fontSize: 15 }}>{selected.name}</b>
            </div>
            {selected.type === "PC" && (
              <button className="btn-mini-danger" onClick={() => handleDeleteFleet(selected.id, selected.name)}>Hapus</button>
            )}
          </div>

          <div className="field-label" style={{ marginBottom: 4 }}>PIT</div>
          <select
            value={selected.pit_id || ""}
            onChange={(e) =>
              selected.type === "PC"
                ? handleSetFleetPit(selected.id, e.target.value)
                : handleSetUnitPit(selected.id, e.target.value)
            }
            style={{ marginBottom: selected.type === "HD" ? 10 : 0 }}
          >
            <option value="">-- Belum ada PIT --</option>
            {pits.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          {selected.type === "HD" && (
            <>
              <div className="field-label" style={{ marginBottom: 4 }}>PC (Fleet)</div>
              <select
                value={selected.fleet_id || ""}
                onChange={(e) => handleAssignFleet(selected.id, e.target.value)}
              >
                <option value="">-- Belum gabung PC --</option>
                {fleets.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </>
          )}

          {selected.type === "PC" && (
            <div className="hint" style={{ marginTop: 8 }}>{selected.memberCount} HD gabung di PC ini.</div>
          )}
        </div>
      )}

      <div className="card">
        <div className="section-title">
          Daftar Unit ({filteredRows.length}/{rows.length})
        </div>
        <div className="table-scroll">
          <table className="list-table">
            <thead>
              <tr><th>Unit</th><th>Tipe</th><th>PIT</th><th>PC</th></tr>
            </thead>
            <tbody>
              {filteredRows.map((r) => (
                <tr
                  key={r.key}
                  className={r.key === selectedKey ? "row-selected" : ""}
                  onClick={() => setSelectedKey(r.key)}
                >
                  <td style={{ fontWeight: 600 }}>{r.name}</td>
                  <td><span className={r.type === "PC" ? "badge badge-pc" : "badge badge-hd"}>{r.type}</span></td>
                  <td>{r.pit_name || "-"}</td>
                  <td>{r.type === "PC" ? "-" : (r.pc_name || "-")}</td>
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr><td colSpan={4} className="hint">Gak ada unit yang cocok.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <button
          className="btn btn-secondary"
          style={{ marginBottom: showAddPit ? 10 : 0 }}
          onClick={() => setShowAddPit(!showAddPit)}
        >
          {showAddPit ? "Batal" : "+ Tambah Lokasi PIT Baru"}
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
              <option value="">-- Tanpa PIT dulu --</option>
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

      <div className="app-footer">designed by Najib.dev</div>
    </div>
  );
        }
                  
