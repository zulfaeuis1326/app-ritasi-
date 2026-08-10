import { useState } from "react";
import { useRouter } from "next/router";

export default function Register() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal daftar");
        return;
      }
      router.push("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <div className="card header-card">
        <div className="clock" style={{ fontSize: 22 }}>Daftar Akun</div>
      </div>
      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="section-title">Username</div>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #d1d5db", marginBottom: 10, fontSize: 16 }}
            autoCapitalize="none"
          />
          <div className="section-title">Password (min. 4 karakter)</div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #d1d5db", marginBottom: 10, fontSize: 16 }}
          />
          {error && <div className="hint" style={{ color: "#b91c1c", marginBottom: 10 }}>{error}</div>}
          <button className="btn btn-secondary" disabled={loading}>
            {loading ? "Memproses..." : "Daftar"}
          </button>
        </form>
        <div className="hint" style={{ textAlign: "center", marginTop: 14 }}>
          Sudah punya akun? <a href="/login">Login di sini</a>
        </div>
      </div>
    </div>
  );
}
