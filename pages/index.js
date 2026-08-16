import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import { atLeast, ROLE_LABEL } from "../lib/roles";

const MATERIALS = ["OB", "COAL", "SOIL", "SOLU", "MUD"];

function formatJamCell(h) {
  if (!h || h.total === 0) return "-";
  const entries = Object.entries(h.materials);
  if (entries.length === 1) return entries[0][0] + " x" + h.total;
  const rincian = entries.map(function (e) { return e[0] + ":" + e[1]; }).join(", ");
  return h.total + " (" + rincian + ")";
}

// Daftar jam yang boleh dipilih manual: dari awal shift sampai jam sekarang (kronologis).
// Dipakai buat nutup ritasi yang kelewat (operator gak boleh pegang HP saat unit jalan).
function buildSelectableHours(shiftType, currentHour) {
  const start = shiftType === 1 ? 7 : 19;
  const rel = (h) => (h - start + 24) % 24;
  const maxRel = rel(currentHour);
  const result = [];
  for (let r = 0; r <= maxRel; r++) {
    result.push((start + r) % 24);
  }
  return result;
}

export default function Home() {
  const router = useRouter();
  const [authUser, setAuthUser] = useState(undefined);
  const [clock, setClock] = useState("");
  const [units, setUnits] = useState([]);
  const [selectedUnit, setSelectedUnit] = useState("");
  const [material, setMaterial] = useState("");
  const [selectedJam, setSelectedJam] = useState("");
  const [recap, setRecap] = useState(null);
  const [recapError, setRecapError] = useState(null);
  const [newUnitName, setNewUnitName] = useState("");
  const [loadingClick, setLoadingClick] = useState(false);
  const [closing, setClosing] = useState(false);
  const [pastShifts, setPastShifts] = useState([]);
  const [history, setHistory] = useState([]);
  const [logoFailed, setLogoFailed] = useState(false);
  const [cacheBuster] = useState(function () { return Date.now(); });

  // Khusus operator yang belum pilih unit (setup sekali di awal)
  const [setupUnits, setSetupUnits] = useState([]);
  const [settingUnit, setSettingUnit] = useState(false);

  const isAdmin = !!authUser && atLeast(authUser.role, "admin");
  const isOperator = !!authUser && authUser.role === "operator";
  const isPengawas = !!authUser && authUser.role === "pengawas";
  const canMonitorAll = !!authUser && atLeast(authUser.role, "pengawas");
  const canClickRitasi = !!authUser && (isOperator || isAdmin);
  const needsUnitSetup = isOperator && !authUser.unit_id;

  // Khusus operator setup awal: daftarkan unit baru sendiri (bukan pilih dari list)
  const [newSetupUnitName, setNewSetupUnitName] = useState("");

  const loadUnits = useCallback(async function () {
    const res = await fetch("/api/units");
    const data = await res.json();
    setUnits(data);
  }, []);

  const loadRecap = useCallback(async function () {
    try {
      const res = await fetch("/api/ritasi");
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(function () { return {}; });
        setRecapError(data.error || ("Error " + res.status));
        return;
      }
      const data = await res.json();
      setRecap(data);
      setRecapError(null);
    } catch (err) {
      setRecapError(err.message);
    }
  }, [router]);

  const loadPastShifts = useCallback(async function () {
    const res = await fetch("/api/shift/list");
    const data = await res.json();
    setPastShifts(data.filter(function (s) { return s.status === "closed"; }));
  }, []);

  const loadHistory = useCallback(async function () {
    try {
      const res = await fetch("/api/ritasi/history");
      if (!res.ok) return;
      const data = await res.json();
      setHistory(data.clicks || []);
    } catch (err) {
      // diamkan — bukan bagian kritis
    }
  }, []);

  useEffect(function () {
    function checkAuth() {
      fetch("/api/auth/me", { cache: "no-store" })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (!data.user) {
            router.push("/login");
          } else {
            setAuthUser(data.user);
          }
        })
        .catch(function () { router.push("/login"); });
    }
    checkAuth();

    function handlePageShow(e) {
      if (e.persisted) {
        window.location.reload();
      }
    }
    window.addEventListener("pageshow", handlePageShow);
    return function () { window.removeEventListener("pageshow", handlePageShow); };
  }, [router]);

  // Operator: kunci selectedUnit ke unit mereka sendiri. Admin: bebas pilih dari daftar unit.
  useEffect(function () {
    if (!authUser) return;
    if (isOperator && authUser.unit_id) {
      setSelectedUnit(String(authUser.unit_id));
    }
  }, [authUser, isOperator]);

  useEffect(function () {
    if (!authUser || needsUnitSetup) return;
    if (isAdmin) {
      loadUnits();
    }
    if (canMonitorAll) {
      loadPastShifts();
    }
    loadRecap();
    loadHistory();
    const poll = setInterval(function () {
      loadRecap();
      loadHistory();
    }, 5000);
    return function () { clearInterval(poll); };
  }, [authUser, needsUnitSetup, isAdmin, canMonitorAll, loadUnits, loadRecap, loadPastShifts, loadHistory]);

  // Auto-perbaiki selectedUnit kalau nyasar/dihapus — cuma berlaku buat admin,
  // operator sudah dikunci di effect sebelumnya.
  useEffect(function () {
    if (!isAdmin) return;
    if (units.length === 0) {
      if (selectedUnit !== "") setSelectedUnit("");
      return;
    }
    const stillValid = units.some(function (u) { return String(u.id) === selectedUnit; });
    if (!stillValid) setSelectedUnit(String(units[0].id));
  }, [units, selectedUnit, isAdmin]);

  useEffect(function () {
    function tick() { setClock(new Date().toLocaleTimeString("id-ID")); }
    tick();
    const t = setInterval(tick, 1000);
    return function () { clearInterval(t); };
  }, []);

  // Ambil daftar unit buat layar setup sekali di awal (operator baru, belum pilih unit)
  useEffect(function () {
    if (!needsUnitSetup) return;
    fetch("/api/units")
      .then(function (res) { return res.json(); })
      .then(function (data) { setSetupUnits(data); })
      .catch(function () { setSetupUnits([]); });
  }, [needsUnitSetup]);

  async function handleSetUnit(unitId) {
    if (!confirm("Kunci akun kamu ke unit ini untuk sesi login sekarang? Kalau mau ganti unit, logout dulu lalu login lagi.")) return;
    setSettingUnit(true);
    try {
      const res = await fetch("/api/auth/set-unit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitId: unitId }),
      });
      if (res.ok) {
        window.location.reload();
      } else {
        const data = await res.json().catch(function () { return {}; });
        alert("Gagal memilih unit: " + (data.error || res.status));
      }
    } catch (err) {
      alert("Gagal memilih unit (koneksi/server bermasalah): " + err.message);
    } finally {
      setSettingUnit(false);
    }
  }

  async function handleRegisterOwnUnit(e) {
    e.preventDefault();
    if (!newSetupUnitName.trim()) return;
    if (!confirm("Daftarkan unit \"" + newSetupUnitName.trim() + "\" dan langsung pakai unit ini? Kalau mau ganti nanti, logout dulu lalu login lagi.")) return;
    setSettingUnit(true);
    try {
      const res = await fetch("/api/auth/set-unit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newUnitName: newSetupUnitName.trim() }),
      });
      if (res.ok) {
        window.location.reload();
      } else {
        const data = await res.json().catch(function () { return {}; });
        alert("Gagal mendaftarkan unit: " + (data.error || res.status));
      }
    } catch (err) {
      alert("Gagal mendaftarkan unit (koneksi/server bermasalah): " + err.message);
    } finally {
      setSettingUnit(false);
    }
  }

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
        body: JSON.stringify({
          unitId: Number(selectedUnit),
          material: material,
          jam: selectedJam === "" ? undefined : Number(selectedJam),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(function () { return {}; });
        alert("Gagal mencatat ritasi: " + (data.error || res.status));
        return;
      }
      const data = await res.json();
      setRecap(data);
      setSelectedJam(""); // balik ke default (jam sekarang) buat klik berikutnya
      loadHistory();
    } catch (err) {
      alert("Gagal mencatat ritasi (koneksi/server bermasalah): " + err.message);
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
        const data = await res.json().catch(function () { return {}; });
        alert("Gagal menghapus entri: " + (data.error || res.status));
      }
    } catch (err) {
      alert("Gagal menghapus entri (koneksi/server bermasalah): " + err.message);
    }
  }

  async function handleDeleteUnit(unitId) {
    const unit = units.find(function (u) { return String(u.id) === String(unitId); });
    const unitName = unit ? unit.name : "";
    if (!confirm("Hapus unit \"" + unitName + "\"? Riwayat ritasi unit ini di shift-shift sebelumnya tetap tersimpan, tapi unit ini tidak akan muncul lagi untuk input baru.")) {
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
        const data = await res.json().catch(function () { return {}; });
        alert("Gagal menghapus unit: " + (data.error || res.status));
      }
    } catch (err) {
      alert("Gagal menghapus unit (koneksi/server bermasalah): " + err.message);
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
        const data = await res.json().catch(function () { return {}; });
        alert("Gagal menambah unit: " + (data.error || res.status));
      }
    } catch (err) {
      alert("Gagal menambah unit (koneksi/server bermasalah): " + err.message);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  async function handleCloseShift() {
    if (!confirm("Yakin tutup shift sekarang? Data shift ini akan dikunci (tidak otomatis export — export dilakukan terpisah).")) return;
    setClosing(true);
    try {
      await fetch("/api/shift/close", { method: "POST" });
      await loadRecap();
      await loadPastShifts();
    } finally {
      setClosing(false);
    }
  }

  const selectedUnitRecap = recap && recap.units
    ? recap.units.find(function (u) { return String(u.id) === selectedUnit; })
    : null;
  const currentHourData = selectedUnitRecap && selectedUnitRecap.hourly
    ? selectedUnitRecap.hourly.find(function (h) { return h.jam === (recap ? recap.currentHour : null); })
    : null;

  if (authUser === undefined) {
    return (
      <div className="container">
        <div className="card"><div className="hint">Memuat...</div></div>
      </div>
    );
  }
  if (authUser === null) {
    return null;
  }

  // Layar setup sekali di awal — operator baru wajib pilih unit dulu sebelum bisa apa-apa
  if (needsUnitSetup) {
    return (
      <div className="container">
        <div className="card header-card">
          <div className="clock" style={{ fontSize: 22 }}>Pilih Unit Kamu</div>
          <div className="hint" style={{ textAlign: "center" }}>
            Halo {authUser.username} — pilih 1 unit yang akan kamu operasikan. Setelah dipilih,
            unit ini terkunci sampai kamu logout. Mau ganti unit? Logout dulu, lalu login lagi.
          </div>
        </div>
        <div className="card">
          {setupUnits.length === 0 && <div className="hint">Belum ada unit terdaftar — daftarkan unit kamu sendiri di bawah.</div>}
          {setupUnits.map(function (u) {
            return (
              <button
                key={u.id}
                className="btn btn-secondary"
                disabled={settingUnit}
                onClick={function () { handleSetUnit(u.id); }}
              >
                {u.name}
              </button>
            );
          })}
        </div>
        <div className="card">
          <div className="section-title">Nomor unit kamu tidak ada di atas?</div>
          <form onSubmit={handleRegisterOwnUnit} style={{ display: "flex", gap: 8 }}>
            <input
              value={newSetupUnitName}
              onChange={function (e) { setNewSetupUnitName(e.target.value); }}
              placeholder="Contoh: HD-07"
              style={{ flex: 1 }}
              disabled={settingUnit}
            />
            <button className="btn btn-secondary" style={{ width: "auto", padding: "0 16px" }} disabled={settingUnit}>
              Daftarkan
            </button>
          </form>
          <div className="hint">Ketik nomor unit kamu sendiri kalau belum ada di daftar tombol di atas.</div>
        </div>
        <div className="card">
          <button className="btn-mini-danger" onClick={handleLogout}>Logout</button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="card header-card">
        <img
          src={"/logo.png?v=" + cacheBuster}
          alt="Logo"
          className="app-logo"
          onError={function (e) { e.target.style.display = "none"; setLogoFailed(true); }}
          onLoad={function () { setLogoFailed(false); }}
        />
        {logoFailed && (
          <div className="hint" style={{ textAlign: "center", color: "var(--danger)" }}>
            Logo belum ditemukan di /logo.png - cek lagi file ada di folder public/ repo
          </div>
        )}
        <div className="clock">{clock}</div>
        <div className="shift-label">
          {recapError ? ("Error: " + recapError) : (recap && recap.shift ? recap.shift.label : "Memuat shift...")}
        </div>
        {recap && recap.tzInfo && (
          <div className="hint" style={{ textAlign: "center" }}>Zona waktu server: {recap.tzInfo}</div>
        )}
        <div className="stat-row" style={{ marginTop: 12 }}>
          <span>{authUser.username} ({ROLE_LABEL[authUser.role] || authUser.role})</span>
          <button className="btn-mini-danger" onClick={handleLogout}>Logout</button>
        </div>
        {canMonitorAll && (
          <a href="/dashboard" className="hint" style={{ display: "block", textAlign: "center", marginTop: 8 }}>
            Buka Dashboard Analitik
          </a>
        )}
        {canMonitorAll && (
          <a href="/admin/fleet" className="hint" style={{ display: "block", textAlign: "center", marginTop: 4 }}>
            Kelola Fleet
          </a>
        )}
        {isAdmin && (
          <a href="/admin/operators" className="hint" style={{ display: "block", textAlign: "center", marginTop: 4 }}>
            Kelola Akun
          </a>
        )}
      </div>

      {canClickRitasi && (
        <div className="card">
          <div className="section-title">Unit</div>
          {isAdmin ? (
            <>
              <select value={selectedUnit} onChange={function (e) { setSelectedUnit(e.target.value); }}>
                {units.length === 0 && <option value="">Belum ada unit</option>}
                {units.map(function (u) {
                  return <option key={u.id} value={u.id}>{u.name}</option>;
                })}
              </select>
              {selectedUnit && (
                <button
                  className="btn"
                  style={{ background: "transparent", color: "var(--danger)", border: "1px solid var(--danger)", marginBottom: 10 }}
                  onClick={function () { handleDeleteUnit(selectedUnit); }}
                >
                  Hapus Unit Ini
                </button>
              )}
            </>
          ) : (
            <div className="hint" style={{ fontSize: 16, color: "var(--text)", marginBottom: 10 }}>
              Unit kamu: <b>{authUser.unit_name}</b> (terkunci sampai logout — logout & login lagi untuk ganti unit)
            </div>
          )}

          <div className="section-title">Material aktif</div>
          <div className="material-grid">
            {MATERIALS.map(function (m) {
              return (
                <button
                  key={m}
                  className={"material-btn " + (material === m ? "active" : "")}
                  onClick={function () { setMaterial(m); }}
                >
                  {m}
                </button>
              );
            })}
          </div>

          <div className="section-title">Jam Ritasi</div>
          <select
            value={selectedJam}
            onChange={function (e) { setSelectedJam(e.target.value); }}
            style={{ marginBottom: 10 }}
          >
            <option value="">Sekarang ({recap ? String(recap.currentHour).padStart(2, "0") + ":00" : "-"})</option>
            {recap && recap.shift && buildSelectableHours(recap.shift.shift_type, recap.currentHour)
              .filter(function (h) { return h !== recap.currentHour; })
              .map(function (h) {
                return (
                  <option key={h} value={h}>
                    {String(h).padStart(2, "0") + ":00 (kelewat)"}
                  </option>
                );
              })}
          </select>
          {selectedJam !== "" && (
            <div className="hint" style={{ marginBottom: 8 }}>
              Ritasi ini akan dicatat buat jam {String(selectedJam).padStart(2, "0")}:00 (bukan jam sekarang) — buat nutup yang kelewat.
            </div>
          )}

          <button
            className="big-click-btn"
            disabled={!selectedUnit || !material || loadingClick}
            onClick={handleClick}
          >
            {loadingClick ? "..." : "+ RITASI"}
          </button>

          <div className="stat-row">
            <span>Ritasi jam ini ({recap ? recap.currentHour : "-"})</span>
            <b>{currentHourData ? currentHourData.total : 0}</b>
          </div>
          <div className="stat-row">
            <span>Total shift ini</span>
            <b>{selectedUnitRecap ? selectedUnitRecap.total : 0}</b>
          </div>
          {!material && <div className="hint">Pilih material dulu sebelum klik ritasi.</div>}
        </div>
      )}

      {isAdmin && (
        <div className="card">
          <div className="section-title">Tambah Unit</div>
          <form onSubmit={handleAddUnit} style={{ display: "flex", gap: 8 }}>
            <input
              value={newUnitName}
              onChange={function (e) { setNewUnitName(e.target.value); }}
              placeholder="Contoh: HD-05"
              style={{ flex: 1 }}
            />
            <button classNam
