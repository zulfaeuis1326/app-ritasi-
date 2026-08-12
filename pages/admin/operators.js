import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import { atLeast, ALL_ROLES, ROLE_LABEL } from "../../lib/roles";

export default function AdminOperators() {
  const router = useRouter();
  const [authUser, setAuthUser] = useState(undefined);
  const [list, setList] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((res) => res.json())
      .then((d) => {
        if (!d.user) router.push("/login");
        else if (!atLeast(d.user.role, "admin")) router.push("/");
        else setAuthUser(d.user);
      })
      .catch(() => router.push("/login"));
  }, [router]);

  const loadList = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/operators");
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || `Error ${res.status}`);
        return;
      }
      setList(await res.json());
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    if (authUser) loadList();
  }, [authUser, loadList]);

  async function handleReset(userId, username) {
    if (!confirm(`Reset unit untuk "${username}"? Dia akan diminta memilih unit lagi saat login berikutnya.`)) return;
    try {
      const res = await fetch("/api/admin/operators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action: "reset_unit" }),
      });
      if (res.ok) {
        await loadList();
      } else {
        const d = await res.json().catch(() => ({}));
        alert(`Gagal reset: ${d.error || res.status}`);
      }
    } catch (err) {
      alert(`Gagal reset (koneksi/server bermasalah): ${err.message}`);
    }
  }

  async function handleSetRole(userId, username, newRole) {
    if (!confirm(`Ubah role "${username}" jadi ${ROLE_LABEL[newRole]}?`)) return;
    try {
      const res = await fetch("/api/admin/operators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action: "set_role", newRole }),
      });
      if (res.ok) {
        await loadList();
      } else {
        const d = await res.json().catch(() => ({}));
        alert(`Gagal ubah role: ${d.error || res.status}`);
      }
    } catch (err) {
      alert(`Gagal ubah role (koneksi/server bermasalah): ${err.message}`);
    }
  }

  async function handleDelete(userId, username) {
    if (!confirm(`Hapus akun "${username}"? Login-nya akan hilang permanen (riwayat ritasi yang pernah dia input TETAP ada, cuma tidak lagi tercatat atas nama dia).`)) return;
    try {
      const res = await fetch("/api/admin/operators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action: "delete_user" }),
      });
      if (res.ok) {
        await loadList();
      } else {
        const d = await res.json().catch(() => ({}));
        alert(`Gagal hapus akun: ${d.error || res.status}`);
      }
    } catch (err) {
      alert(`Gagal hapus akun (koneksi/server bermasalah): ${err.message}`);
    }
  }

  if (authUser === undefined || authUser === null) {
    return (
      <div className="container">
        <div className="card"><div className="hint">Memuat...</div></div>
      </div>
    );
  }

  // Admin biasa cuma boleh set role pengawas/operator; superadmin bebas semua role.
  const assignableRoles = authUser.role === "superadmin" ? ALL_ROLES : ["pengawas", "operator"];

  return (
    <div className="container">
      <div className="card header-card">
        <div className="clock" style={{ fontSize: 22 }}>Kelola Akun</div>
        <a href="/" className="hint" style={{ display: "block", textAlign: "center", marginTop: 6 }}>
          ← Kembali ke halaman input
        </a>
      </div>

      {error && (
        <div className="card"><div className="hint" style={{ color: "#e63946" }}>Error: {error}</div></div>
      )}

      <div className="card">
        <div className="section-title">Daftar Akun</div>
        {list.map((u) => (
          <div key={u.id} className="history-row">
            <div className="history-info">
              <b>{u.username}</b> ({ROLE_LABEL[u.role] || u.role})
              <div className="hint">
                {u.role === "operator"
                  ? (u.unit_name ? `Unit: ${u.unit_name}` : "Belum pilih unit")
                  : "Tidak terkunci ke unit manapun"}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              {u.role === "operator" && u.unit_id && (
                <button className="btn-mini-danger" onClick={() => handleReset(u.id, u.username)}>
                  Reset Unit
                </button>
              )}
              {u.id !== authUser.id && (
                <>
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val) handleSetRole(u.id, u.username, val);
                      e.target.value = "";
                    }}
                  >
                    <option value="" disabled>Ubah role...</option>
                    {assignableRoles
                      .filter((r) => r !== u.role)
                      .map((r) => (
                        <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                      ))}
                  </select>
                  {/* Admin biasa cuma boleh hapus akun pengawas/operator; superadmin bebas semua */}
                  {(authUser.role === "superadmin" || (u.role !== "admin" && u.role !== "superadmin")) && (
                    <button className="btn-mini-danger" onClick={() => handleDelete(u.id, u.username)}>
                      Hapus Akun
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
        {list.length === 0 && !error && <div className="hint">Belum ada akun.</div>}
      </div>

      <div className="app-footer">designed by Najib.dev</div>
    </div>
  );
        }
