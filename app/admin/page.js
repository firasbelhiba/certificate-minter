"use client";

import { useEffect, useState } from "react";

export default function Admin() {
  const [config, setConfig] = useState(null);
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [loginErr, setLoginErr] = useState("");

  const [data, setData] = useState(null);
  const [course, setCourse] = useState("");
  const [issuer, setIssuer] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    fetch("/api/config").then((r) => r.json()).then(setConfig).catch(() => {});
    const saved = window.localStorage.getItem("cert_admin_pw");
    if (saved) {
      setPassword(saved);
      verify(saved);
    }
  }, []);

  function authHeaders(pw) {
    return { "Content-Type": "application/json", "x-admin-password": pw || password };
  }

  async function verify(pw) {
    setLoginErr("");
    try {
      const res = await fetch("/api/admin/verify", {
        method: "POST",
        headers: authHeaders(pw),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Login failed");
      }
      setAuthed(true);
      window.localStorage.setItem("cert_admin_pw", pw || password);
      loadStudents(pw);
    } catch (e) {
      setAuthed(false);
      setLoginErr(e.message);
    }
  }

  async function loadStudents(pw) {
    const res = await fetch("/api/admin/students", { headers: authHeaders(pw) });
    if (res.ok) setData(await res.json());
  }

  async function mintAll() {
    if (!course.trim()) {
      setMsg({ type: "err", text: "Enter a course name first." });
      return;
    }
    setBusy("mint");
    let totalMinted = 0;
    let totalFailed = 0;
    try {
      // Loop batches until nothing is left to mint.
      for (let i = 0; i < 200; i++) {
        setMsg({ type: "info", text: `Minting on Hedera… ${totalMinted} done so far.` });
        const res = await fetch("/api/admin/mint-all", {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ course, issuer, date }),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || "Mint failed");
        totalMinted += d.minted;
        totalFailed += d.failed;
        loadStudents();
        if (!d.remaining && !d.minted) break;
        if (!d.remaining) break;
      }
      setMsg({ type: "ok", text: `Done. Minted ${totalMinted}${totalFailed ? `, ${totalFailed} failed` : ""}.` });
      loadStudents();
    } catch (e) {
      setMsg({ type: "err", text: e.message });
    } finally {
      setBusy("");
    }
  }

  async function distribute() {
    setBusy("dist");
    let totalSent = 0;
    try {
      for (let i = 0; i < 200; i++) {
        setMsg({ type: "info", text: `Sending to associated students… ${totalSent} sent.` });
        const res = await fetch("/api/admin/distribute", {
          method: "POST",
          headers: authHeaders(),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || "Distribute failed");
        totalSent += d.sent;
        loadStudents();
        if (!d.remaining) break;
      }
      setMsg({ type: "ok", text: `Sent ${totalSent}. Students who haven't associated yet can claim themselves.` });
      loadStudents();
    } catch (e) {
      setMsg({ type: "err", text: e.message });
    } finally {
      setBusy("");
    }
  }

  if (!authed) {
    return (
      <div className="wrap" style={{ maxWidth: 420 }}>
        <div className="header">
          <h1>🔒 Instructor Login</h1>
        </div>
        <div className="card">
          <label>Admin password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && verify()}
            placeholder="••••••••"
          />
          <button onClick={() => verify()}>Log in</button>
          {loginErr && <div className="result err" style={{ marginTop: 12 }}>{loginErr}</div>}
          {config && !config.adminConfigured && (
            <div className="result err" style={{ marginTop: 12 }}>
              ADMIN_PASSWORD isn't set on the server. Add it to your env.
            </div>
          )}
        </div>
        <div className="foot"><a href="/" style={{ color: "#00c2ff" }}>← Back to student page</a></div>
      </div>
    );
  }

  const c = data?.counts;

  return (
    <div className="wrap">
      <div className="header">
        <h1>🎓 Instructor Dashboard</h1>
        <p style={{ color: "#8a95ad", fontSize: 13 }}>
          Token {data?.tokenId || config?.tokenId} · {config?.network} · storage: {config?.storage}
        </p>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <h2>Mint certificates</h2>
        <div className="sub">Applied to every registered student who doesn't have one yet.</div>
        <div className="grid">
          <div>
            <label>Course name *</label>
            <input value={course} onChange={(e) => setCourse(e.target.value)} placeholder="Blockchain Masterclass" />
          </div>
          <div>
            <label>Issuer</label>
            <input value={issuer} onChange={(e) => setIssuer(e.target.value)} placeholder="Your Academy" />
          </div>
        </div>
        <label>Date</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />

        <div className="grid" style={{ marginTop: 6 }}>
          <button onClick={mintAll} disabled={busy === "mint"}>
            {busy === "mint" ? "Minting…" : `Mint all (${c?.registered ?? 0} pending)`}
          </button>
          <button className="secondary" onClick={distribute} disabled={busy === "dist"}>
            {busy === "dist" ? "Sending…" : "Send to associated"}
          </button>
        </div>
      </div>

      {c && (
        <div className="token-badge" style={{ marginBottom: 14 }}>
          <b>{c.total}</b> total · <b>{c.registered}</b> registered · <b>{c.minted}</b> minted · <b>{c.transferred}</b> received
          <button className="secondary" style={{ marginTop: 10 }} onClick={() => loadStudents()}>Refresh</button>
        </div>
      )}

      {msg && <div className={`result ${msg.type === "ok" ? "ok" : msg.type === "err" ? "err" : ""}`} style={msg.type === "info" ? { background: "#131a2c", border: "1px solid #263048" } : {}}>{msg.text}</div>}

      <div className="card" style={{ marginTop: 18 }}>
        <h2>Students</h2>
        <table className="tbl">
          <thead>
            <tr><th>Name</th><th>Account</th><th>Status</th><th>Serial</th></tr>
          </thead>
          <tbody>
            {(data?.students || []).map((s) => (
              <tr key={s.accountId}>
                <td>{s.name}</td>
                <td className="mono">{s.accountId}</td>
                <td><span className={`pill ${s.status}`}>{s.status}</span></td>
                <td>{s.hashscan ? <a href={s.hashscan} target="_blank" rel="noreferrer">#{s.serial}</a> : "—"}</td>
              </tr>
            ))}
            {(!data?.students || data.students.length === 0) && (
              <tr><td colSpan={4} style={{ color: "#8a95ad" }}>No students registered yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="foot"><a href="/" style={{ color: "#00c2ff" }}>← Student page</a></div>
    </div>
  );
}
