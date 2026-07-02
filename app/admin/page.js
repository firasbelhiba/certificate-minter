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
  const [progress, setProgress] = useState(null); // { total, done, log: [] }

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
    setMsg(null);
    const total = c?.registered ?? 0;
    const log = [];
    setProgress({ total, done: 0, log });
    let totalMinted = 0;
    let totalFailed = 0;
    try {
      // Loop batches until nothing is left to mint.
      for (let i = 0; i < 500; i++) {
        const res = await fetch("/api/admin/mint-all", {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ course, issuer, date }),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || "Mint failed");
        totalMinted += d.minted;
        totalFailed += d.failed;
        for (const r of d.results || []) log.push(r);
        setProgress({ total, done: totalMinted + totalFailed, log: [...log] });
        loadStudents();
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

  async function resetDb() {
    if (
      !window.confirm(
        "Clear ALL students and certificate records? This starts the app from scratch. (On-chain NFTs already sent are unaffected.)"
      )
    )
      return;
    setBusy("reset");
    setMsg(null);
    setProgress(null);
    try {
      const res = await fetch("/api/admin/reset", {
        method: "POST",
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error("Reset failed");
      setMsg({ type: "ok", text: "Database cleared. Ready for a fresh class." });
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
          <div className="grid" style={{ marginTop: 10 }}>
            <button className="secondary" onClick={() => loadStudents()}>Refresh</button>
            <button className="danger" onClick={resetDb} disabled={busy === "reset"}>
              {busy === "reset" ? "Clearing…" : "🗑 Clear all students"}
            </button>
          </div>
        </div>
      )}

      {progress && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 8 }}>
            <span>{busy === "mint" ? "Minting certificates…" : "Minting complete"}</span>
            <b>{progress.done}/{progress.total}</b>
          </div>
          <div className="bar">
            <div
              className="bar-fill"
              style={{ width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%` }}
            />
          </div>
          <div className="mint-log">
            {progress.log.slice().reverse().map((r, i) => (
              <div key={i} className="mint-log-row">
                <span>{r.ok ? "✅" : "❌"} {r.name}</span>
                <span className="mono">{r.ok ? `#${r.serial}` : (r.error || "failed").slice(0, 30)}</span>
              </div>
            ))}
          </div>
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
