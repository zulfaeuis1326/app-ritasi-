import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";

const MATERIALS = [
  "OB",
  "COAL",
  "SOIL",
  "SOLU",
  "MUD"
];

function formatJamCell(h) {
  if (!h || h.total === 0) return "-";

  const entries = Object.entries(h.materials);

  if (entries.length === 1) {
    return `${h.total} (${entries[0][0]})`;
  }

  return `${h.total} (${entries
    .map(([m, n]) => `${m}:${n}`)
    .join(", ")})`;
}

export default function Home() {
  const router = useRouter();

  const [authUser, setAuthUser] = useState(undefined);

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

  const [darkMode, setDarkMode] = useState(false);

  const [historySearch, setHistorySearch] = useState("");

  /* =========================
     LOAD UNITS
  ========================= */

  const loadUnits = useCallback(async () => {
    try {
      const res = await fetch("/api/units");

      const data = await res.json();

      setUnits(data);
    } catch (err) {
      console.error("Gagal mengambil unit:", err);
    }
  }, []);

  /* =========================
     LOAD RECAP
  ========================= */

  const loadRecap = useCallback(async () => {
    try {
      const res = await fetch("/api/ritasi");

      if (res.status === 401) {
        router.push("/login");
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));

        setRecapError(
          data.error || `Error ${res.status}`
        );

        return;
      }

      const data = await res.json();

      setRecap(data);

      setRecapError(null);
    } catch (err) {
      setRecapError(err.message);
    }
  }, [router]);

  /* =========================
     LOAD PAST SHIFT
  ========================= */

  const loadPastShifts = useCallback(async () => {
    try {
      const res = await fetch("/api/shift/list");

      const data = await res.json();

      setPastShifts(
        data.filter(
          (s) => s.status === "closed"
        )
      );
    } catch (err) {
      console.error(err);
    }
  }, []);

  /* =========================
     LOAD HISTORY
  ========================= */

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch(
        "/api/ritasi/history"
      );

      if (!res.ok) return;

      const data = await res.json();

      setHistory(data.clicks || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  /* =========================
     AUTH
  ========================= */

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

  /* =========================
     LOAD DATA
  ========================= */

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
  }, [
    authUser,
    loadUnits,
    loadRecap,
    loadPastShifts,
    loadHistory
  ]);

  /* =========================
     VALIDATE SELECTED UNIT
  ========================= */

  useEffect(() => {
    if (units.length === 0) {
      if (selectedUnit !== "") {
        setSelectedUnit("");
      }

      return;
    }

    const stillValid = units.some(
      (u) => String(u.id) === selectedUnit
    );

    if (!stillValid) {
      setSelectedUnit(
        String(units[0].id)
      );
    }
  }, [units, selectedUnit]);

  /* =========================
     CLOCK
  ========================= */

  useEffect(() => {
    const tick = () => {
      setClock(
        new Date().toLocaleTimeString(
          "id-ID"
        )
      );
    };

    tick();

    const t = setInterval(
      tick,
      1000
    );

    return () => clearInterval(t);
  }, []);

  /* =========================
     DARK MODE
  ========================= */

  useEffect(() => {
    const saved =
      localStorage.getItem(
        "ritasi-theme"
      );

    if (saved === "dark") {
      setDarkMode(true);
    }
  }, []);

  useEffect(() => {
    document.body.classList.toggle(
      "dark",
      darkMode
    );

    localStorage.setItem(
      "ritasi-theme",
      darkMode
        ? "dark"
        : "light"
    );
  }, [darkMode]);

  /* =========================
     HANDLE RITASI
  ========================= */

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
      const res = await fetch(
        "/api/ritasi",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({
            unitId:
              Number(selectedUnit),

            material
          })
        }
      );

      if (!res.ok) {
        const data =
          await res
            .json()
            .catch(
              () => ({})
            );

        alert(
          `Gagal mencatat ritasi: ${
            data.error ||
            res.status
          }`
        );

        return;
      }

      const data =
        await res.json();

      setRecap(data);

      loadHistory();
    } catch (err) {
      alert(
        `Gagal mencatat ritasi: ${err.message}`
      );
    } finally {
      setLoadingClick(false);
    }
  }

  /* =========================
     DELETE HISTORY
  ========================= */

  async function handleDeleteClick(
    clickId
  ) {
    if (
      !confirm(
        "Hapus entri ritasi ini?"
      )
    ) {
      return;
    }

    try {
      const res = await fetch(
        "/api/ritasi/history",
        {
          method: "DELETE",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({
            id: clickId
          })
        }
      );

      if (res.ok) {
        await loadRecap();
        await loadHistory();
      } else {
        const data =
          await res
            .json()
            .catch(
              () => ({})
            );

        alert(
          `Gagal menghapus entri: ${
            data.error ||
            res.status
          }`
        );
      }
    } catch (err) {
      alert(
        `Gagal menghapus entri: ${err.message}`
      );
    }
  }

  /* =========================
     DELETE UNIT
  ========================= */

  async function handleDeleteUnit(
    unitId
  ) {
    const unit =
      units.find(
        (u) =>
          String(u.id) ===
          String(unitId)
      );

    if (
      !confirm(
        `Hapus unit "${unit?.name}"?`
      )
    ) {
      return;
    }

    try {
      const res = await fetch(
        "/api/units",
        {
          method: "DELETE",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({
            id: Number(unitId)
          })
        }
      );

      if (res.ok) {
        setSelectedUnit("");

        await loadUnits();
      } else {
        const data =
          await res
            .json()
            .catch(
              () => ({})
            );

        alert(
          `Gagal menghapus unit: ${
            data.error ||
            res.status
          }`
        );
      }
    } catch (err) {
      alert(
        `Gagal menghapus unit: ${err.message}`
      );
    }
  }

  /* =========================
     ADD UNIT
  ========================= */

  async function handleAddUnit(e) {
    e.preventDefault();

    if (!newUnitName.trim()) {
      return;
    }

    try {
      const res = await fetch(
        "/api/units",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({
            name:
              newUnitName.trim()
          })
        }
      );

      if (res.ok) {
        setNewUnitName("");

        await loadUnits();
      } else {
        const data =
          await res
            .json()
            .catch(
              () => ({})
            );

        alert(
          `Gagal menambah unit: ${
            data.error ||
            res.status
          }`
        );
      }
    } catch (err) {
      alert(
        `Gagal menambah unit: ${err.message}`
      );
    }
  }

  /* =========================
     LOGOUT
  ========================= */

  async function handleLogout() {
    await fetch(
      "/api/auth/logout",
      {
        method: "POST"
      }
    );

    router.push("/login");
  }

  /* =========================
     CLOSE SHIFT
  ========================= */

  async function handleCloseShift() {
    if (
      !confirm(
        "Yakin tutup shift sekarang?"
      )
    ) {
      return;
    }

    setClosing(true);

    try {
      const res =
        await fetch(
          "/api/shift/close",
          {
            method: "POST"
          }
        );

      const data =
        await res.json();

      await loadRecap();

      await loadPastShifts();

      window.open(
        `/api/shift/export?shiftId=${data.closedShiftId}`,
        "_blank"
      );
    } finally {
      setClosing(false);
    }
  }

  /* =========================
     SELECTED DATA
  ========================= */

  const selectedUnitRecap =
    recap?.units?.find(
      (u) =>
        String(u.id) ===
        selectedUnit
    );

  const currentHourData =
    selectedUnitRecap?.hourly?.find(
      (h) =>
        h.jam ===
        recap?.currentHour
    );

  /* =========================
     FILTER HISTORY
  ========================= */

  const filteredHistory =
    history.filter((h) => {
      const q =
        historySearch
          .trim()
          .toLowerCase();

      if (!q) return true;

      return `
        ${h.unit_name}
        ${h.material}
        ${h.operator_name || ""}
        ${h.jam}
      `
        .toLowerCase()
        .includes(q);
    });

  /* =========================
     LOADING
  ========================= */

  if (
    authUser === undefined
  ) {
    return (
      <div className="container">
        <div className="card">
          <div className="hint">
            Memuat...
          </div>
        </div>
      </div>
    );
  }

  if (authUser === null) {
    return null;
  }

  /* =========================
     UI
  ========================= */

  return (
    <div className="container">

      {/* HEADER */}

      <div className="card header-card">

        <img
          src={`/logo.png?v=${cacheBuster}`}
          alt="Logo"
          className="app-logo"

          onError={(e) => {
            e.target.style.display =
              "none";

            setLogoFailed(true);
          }}

          onLoad={() =>
            setLogoFailed(false)
          }
        />

        {logoFailed && (
          <div
            className="hint"
            style={{
              textAlign:
                "center",
              color:
                "#b91c1c"
            }}
          >
            Logo belum ditemukan
          </div>
        )}

        <div className="clock">
          {clock}
        </div>

        <div className="shift-label">
          {recapError
            ? `Error: ${recapError}`
            : recap?.shift?.label ||
              "Memuat shift..."}
        </div>

        {recap?.tzInfo && (
          <div
            className="hint"
            style={{
              textAlign:
                "center"
            }}
          >
            Zona waktu server:
            {" "}
            {recap.tzInfo}
          </div>
        )}

        <div className="header-actions">

          <div className="user-label">
            {authUser.username}
            {" · "}
            {authUser.role ===
            "admin"
              ? "Admin"
              : "Operator"}
          </div>

          <div
            style={{
              display: "flex",
              gap: 8
            }}
          >

            <button
              className="theme-btn"
              onClick={() =>
                setDarkMode(
                  (v) => !v
                )
              }
            >
              {darkMode
                ? "☀️ Terang"
                : "🌙 Gelap"}
            </button>

            <button
              className="btn-mini-danger"
              onClick={
                handleLogout
              }
            >
              Logout
            </button>

          </div>

        </div>

        {authUser.role ===
          "admin" && (
          <a
            href="/dashboard"
            className="hint"
            style={{
              display:
                "block",
              textAlign:
                "center",
              marginTop: 10
            }}
          >
            📊 Buka Dashboard Analitik
          </a>
        )}

      </div>


      {/* INPUT RITASI */}

      <div className="card">

        <div className="section-title">
          Unit
        </div>

        <select
          value={selectedUnit}
          onChange={(e) =>
            setSelectedUnit(
              e.target.value
            )
          }
        >

          {units.length === 0 && (
            <option value="">
              Belum ada unit
            </option>
          )}

          {units.map((u) => (
            <option
              key={u.id}
              value={u.id}
            >
              {u.name}
            </option>
          ))}

        </select>


        {selectedUnit &&
          authUser.role ===
            "admin" && (
            <button
              className="btn"
              style={{
                background:
                  "transparent",
                color:
                  "#ef4444",
                border:
                  "1px solid #ef4444",
                marginBottom: 10
              }}

              onClick={() =>
                handleDeleteUnit(
                  selectedUnit
                )
              }
            >
              Hapus Unit Ini
            </button>
          )}


        <div className="section-title">
          Material aktif
        </div>

        <div className="material-grid">

          {MATERIALS.map((m) => (
            <button
              key={m}

              className={
                `material-btn ${
                  material === m
                    ? "active"
                    : ""
                }`
              }

              onClick={() =>
                setMaterial(m)
              }
            >
              {m}
            </button>
          ))}

        </div>


        <button
          className="big-click-btn"

          disabled={
            !selectedUnit ||
            !material ||
            loadingClick
          }

          onClick={
            handleClick
          }
        >
          {loadingClick
            ? "Mencatat..."
            : "+ RITASI"}
        </button>


        <div className="stat-row">

          <span>
            Ritasi jam ini (
            {recap?.currentHour ??
              "-"}
            )
          </span>

          <b>
            {currentHourData
              ?.total ?? 0}
          </b>

        </div>


        <div className="stat-row">

          <span>
            Total shift ini
          </span>

          <b>
            {selectedUnitRecap
              ?.total ?? 0}
          </b>

        </div>


        <div className="quick-summary">

          <div className="summary-box">
            <span>
              Unit aktif
            </span>

            <b>
              {units.length}
            </b>
          </div>

          <div className="summary-box">
            <span>
              Material aktif
            </span>

            <b>
              {material || "-"}
            </b>
          </div>

        </div>


        {!material && (
          <div className="hint">
            Pilih material dulu
            sebelum klik ritasi.
          </div>
        )}

      </div>


      {/* TAMBAH UNIT */}

      <div className="card">

        <div className="section-title">
          Tambah Unit
        </div>

        <form
          onSubmit={
            handleAddUnit
          }

          style={{
            display: "flex",
            gap: 8
          }}
        >

          <input
            value={
              newUnitName
            }

            onChange={(e) =>
              setNewUnitName(
                e.target.value
              )
            }

            placeholder="Contoh: HD-05"
          />

          <button
            className="btn btn-secondary"

            style={{
              width: "auto",
              padding:
                "0 16px"
            }}
          >
            Tambah
          </button>

        </form>

      </div>


      {/* REKAP PER JAM */}

      <div className="card">

        <div className="section-title">
          Rekap Per Jam — Shift Berjalan
        </div>

        <div
          className="hint"
          style={{
            marginBottom: 8
          }}
        >
          Kolom jam{" "}
          <b>
            {String(
              recap?.currentHour ??
                ""
            ).padStart(
              2,
              "0"
            )}
          </b>{" "}
          adalah jam yang
          sedang berjalan.
        </div>

        <div className="table-scroll">

          <table>

            <thead>

              <tr>

                <th>
                  Unit
                </th>

                {recap?.hours?.map(
                  (h) => (
                    <th
                      key={h}
                      className={
                        h ===
                        recap.currentHour
                          ? "current-hour"
                          : ""
                      }
                    >
                      {String(h).padStart(
                        2,
                        "0"
                      )}
                    </th>
                  )
                )}

                <th>
                  Total
                </th>

              </tr>

            </thead>


            <tbody>

              {recap?.units?.map(
                (u) => (
                  <tr
                    key={u.id}
                  >

                    <td
                      style={{
                        fontWeight:
                          700
                      }}
                    >
                      {u.name}
                    </td>

                    {u.hourly.map(
                      (h) => (
                        <td
                          key={h.jam}
                          className={
                            h.jam ===
                            recap.currentHour
                              ? "current-hour"
                              : ""
                          }
                        >
                          {formatJamCell(
                        
