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
        <div className="section-title">Daftar Fleet (PC/Loader) — {fleets.length}</div>
        {fleets.map((f) => {
          const members = units.filter((u) => u.fleet_id === f.id);
          return (
            <div key={f.id} className="history-row" style={{ flexDirection: "column", alignItems: "stretch" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <b>{f.name}</b>
                <button className="btn-mini-danger" onClick={() => handleDeleteFleet(f.id, f.name)}>Hapus</button>
              </div>
              <select
                value={f.pit_id || ""}
                onChange={(e) => handleSetFleetPit(f.id, e.target.value)}
                style={{ marginBottom: 6 }}
              >
                <option value="">-- Belum ada PIT --</option>
                {pits.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <div className="hint">
                HD gabung ({members.length}): {members.length ? members.map((m) => m.name).join(", ") : "belum ada"}
              </div>
            </div>
          );
        })}
        {fleets.length === 0 && <div className="hint">Belum ada PC/fleet.</div>}
      </div>

      <div className="card">
        <div className="section-title">Assign HD ke Fleet — {units.length} unit</div>
        <div className="hint" style={{ marginBottom: 8 }}>
          Pilih fleet (PC) buat tiap unit HD. Juga bisa atur PIT masing-masing unit di sini
          (independen dari PIT fleet-nya, kalau unit dipindah sendiri).
        </div>
        {units.map((u) => (
          <div key={u.id} className="history-row" style={{ flexDirection: "column", alignItems: "stretch" }}>
            <b style={{ marginBottom: 6 }}>{u.name}</b>
            <select
              value={u.fleet_id || ""}
              onChange={(e) => handleAssignFleet(u.id, e.target.value)}
              style={{ marginBottom: 6 }}
            >
              <option value="">-- Belum gabung fleet --</option>
              {fleets.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
            <select
              value={u.pit_id || ""}
              onChange={(e) => handleSetUnitPit(u.id, e.target.value)}
            >
              <option value="">-- Belum ada PIT --</option>
              {pits.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        ))}
        {units.length === 0 && <div className="hint">Belum ada unit HD.</div>}
      </div>

      <div className="app-footer">designed by Najib.dev</div>
    </div>
  );
}
