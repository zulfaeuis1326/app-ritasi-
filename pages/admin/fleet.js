import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import { atLeast } from "../../lib/roles";

// Combobox 1 kotak: ketik buat nyaring, tap buat pilih — pakai <datalist> bawaan browser
// (bukan 2 elemen kepisah). listId wajib unik per pemakaian di halaman yang sama.
function SearchableSelect({ value, onChange, options, placeholder, listId }) {
  const current = options.find((o) => o.value === value);
  const [text, setText] = useState(current ? current.label : "");

  useEffect(() => {
    const opt = options.find((o) => o.value === value);
    setText(opt ? opt.label : "");
  }, [value, options]);

  function handleChange(e) {
    const typed = e.target.value;
    setText(typed);
    if (typed === "") {
      onChange("");
      return;
    }
    const match = options.find((o) => o.label === typed);
    if (match) onChange(match.value);
  }

  return (
    <div className="searchable-select">
      <input
        list={listId}
        value={text}
        onChange={handleChange}
        placeholder={placeholder}
        autoComplete="off"
      />
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o.value} value={o.label} />
        ))}
      </datalist>
    </div>
  );
}

export default function KelolaFleet() {
  const router = useRouter();
  const [authUser, setAuthUser] = useState(undefined);
  const [fleets, setFleets] = useState([]);
  const [units, setUnits] = useState([]);
  const [pits, setPits] = useState([]);
  const [error, setError] = useState(null);

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

  const unitOptions = units.map((u) => ({
    value: String(u.id),
    label: `${u.name}${u.fleet_name ? " → " + u.fleet_name : ""}${u.pit_name ? " (" + u.pit_name + ")" : ""}`,
  }));
  const fleetOptions = fleets.map((f) => ({ value: String(f.id), label: f.name }));
  const pitOptions = pits.map((p) => ({ value: String(p.id), label: p.name }));

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
        <div className="field-label" style={{ marginBottom: 4 }}>Unit</div>
        <SearchableSelect
          value={selectedUnitId}
          onChange={(val) => setSelectedUnitId(val)}
          options={unitOptions}
          placeholder="Ketik buat cari unit, misal H572..."
          listId="dl-unit"
        />

        {selectedUnit && (
          <div style={{ padding: 10, background: "var(--surface-alt)", borderRadius: 8, marginTop: 10 }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>{selectedUnit.name}</div>

            <div className="field-label" style={{ marginBottom: 4 }}>Masuk PC (Fleet)</div>
            <SearchableSelect
              value={selectedUnit.fleet_id ? String(selectedUnit.fleet_id) : ""}
              onChange={(val) => handleAssignFleet(selectedUnit.id, val)}
              options={fleetOptions}
              placeholder="Ketik buat cari PC, misal E520..."
              listId="dl-pc"
            />

            <div className="field-label" style={{ marginBottom: 4, marginTop: 10 }}>Lokasi (PIT)</div>
            <SearchableSelect
              value={selectedUnit.pit_id ? String(selectedUnit.pit_id) : ""}
              onChange={(val) => handleSetUnitPit(selectedUnit.id, val)}
              options={pitOptions}
              placeholder="Ketik buat cari lokasi..."
              listId="dl-pit-unit"
            />
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
          <form onSubmit={handleAddFleet}>
            <div className="field-label" style={{ marginBottom: 4 }}>Nama PC</div>
            <input
              value={newFleetName}
              onChange={(e) => setNewFleetName(e.target.value)}
              placeholder="Contoh: E52099"
              style={{ marginBottom: 10 }}
            />
            <div className="field-label" style={{ marginBottom: 4 }}>Lokasi (PIT)</div>
            <SearchableSelect
              value={newFleetPit}
              onChange={(val) => setNewFleetPit(val)}
              options={pitOptions}
              placeholder="Ketik buat cari lokasi..."
              listId="dl-pit-newpc"
            />
            <button className="btn btn-secondary" style={{ width: "auto", padding: "0 16px", marginTop: 10 }}>
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
