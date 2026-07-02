"use client"; // ce composant s'exécute dans le navigateur (interactif)

// ═══════════════════════════════════════════════════════════════════════════
//  app/admin/page.js — Le TABLEAU DE BORD du formateur (page /admin)
//  Protégé par mot de passe. Permet d'émettre les certificats de toute la
//  classe (avec barre de progression), d'envoyer aux étudiants associés, et
//  de vider la base de données.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react"; // hooks React (état + effets)

export default function Admin() {
  // ─── Les "états" (state) : des variables qui, quand elles changent, redessinent l'écran ───
  const [config, setConfig] = useState(null); // config publique (token, réseau...)
  const [password, setPassword] = useState(""); // le mot de passe saisi
  const [authed, setAuthed] = useState(false); // est-on connecté ?
  const [loginErr, setLoginErr] = useState(""); // message d'erreur de connexion

  const [data, setData] = useState(null); // les étudiants + compteurs
  const [course, setCourse] = useState(""); // nom du cours à émettre
  const [issuer, setIssuer] = useState(""); // l'émetteur
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10)); // la date (aujourd'hui)
  const [busy, setBusy] = useState(""); // quelle action est en cours ("mint", "reset"...)
  const [msg, setMsg] = useState(null); // message affiché (succès/erreur)
  const [progress, setProgress] = useState(null); // { total, done, log: [] } → barre de progression

  // useEffect avec [] = s'exécute une seule fois au chargement de la page.
  useEffect(() => {
    // On récupère la config publique.
    fetch("/api/config").then((r) => r.json()).then(setConfig).catch(() => {});
    // Si un mot de passe est mémorisé dans le navigateur, on se reconnecte auto.
    const saved = window.localStorage.getItem("cert_admin_pw");
    if (saved) {
      setPassword(saved);
      verify(saved);
    }
  }, []);

  // Construit les en-têtes HTTP incluant le mot de passe formateur.
  function authHeaders(pw) {
    return { "Content-Type": "application/json", "x-admin-password": pw || password };
  }

  // Vérifie le mot de passe auprès du serveur ; si OK, on affiche le dashboard.
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
      setAuthed(true); // connecté !
      window.localStorage.setItem("cert_admin_pw", pw || password); // on mémorise
      loadStudents(pw); // on charge la liste
    } catch (e) {
      setAuthed(false);
      setLoginErr(e.message);
    }
  }

  // Charge la liste des étudiants + les compteurs depuis le serveur.
  async function loadStudents(pw) {
    const res = await fetch("/api/admin/students", { headers: authHeaders(pw) });
    if (res.ok) setData(await res.json());
  }

  // ─── Émettre les certificats de toute la classe (avec barre de progression) ───
  async function mintAll() {
    if (!course.trim()) {
      setMsg({ type: "err", text: "Enter a course name first." });
      return;
    }
    setBusy("mint");
    setMsg(null);
    const total = c?.registered ?? 0; // combien à émettre au total
    const log = []; // la liste des étudiants émis (pour l'affichage)
    setProgress({ total, done: 0, log }); // on initialise la barre à 0
    let totalMinted = 0;
    let totalFailed = 0;
    try {
      // On rappelle la route mint-all en boucle : elle traite 5 étudiants par appel.
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
        // On ajoute chaque résultat au journal affiché.
        for (const r of d.results || []) log.push(r);
        // On met à jour la barre de progression.
        setProgress({ total, done: totalMinted + totalFailed, log: [...log] });
        loadStudents();
        if (!d.remaining) break; // plus rien à émettre → on s'arrête
      }
      setMsg({ type: "ok", text: `Done. Minted ${totalMinted}${totalFailed ? `, ${totalFailed} failed` : ""}.` });
      loadStudents();
    } catch (e) {
      setMsg({ type: "err", text: e.message });
    } finally {
      setBusy(""); // fin de l'action
    }
  }

  // ─── Vider la base de données (repartir de zéro) ───
  async function resetDb() {
    // Demande de confirmation avant d'effacer.
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

  // ─── Envoyer les certificats à tous les étudiants DÉJÀ associés ───
  async function distribute() {
    setBusy("dist");
    let totalSent = 0;
    try {
      // Comme le mint, on traite par lots jusqu'à ce qu'il n'en reste plus.
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

  // ─── Si non connecté : on affiche l'écran de connexion ───
  if (!authed) {
    return (
      <div className="wrap" style={{ maxWidth: 420 }}>
        <div className="header">
          <h1>🔒 Instructor Login</h1>
        </div>
        <div className="card">
          <label>Admin password</label>
          {/* Champ mot de passe : Entrée valide la connexion */}
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

  // Raccourci vers les compteurs (total / registered / minted / transferred).
  const c = data?.counts;

  // ─── Si connecté : le tableau de bord ───
  return (
    <div className="wrap">
      {/* En-tête : token, réseau, type de stockage */}
      <div className="header">
        <h1>🎓 Instructor Dashboard</h1>
        <p style={{ color: "#8a95ad", fontSize: 13 }}>
          Token {data?.tokenId || config?.tokenId} · {config?.network} · storage: {config?.storage}
        </p>
      </div>

      {/* Carte "Émettre les certificats" : cours, émetteur, date + boutons */}
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
          {/* Bouton principal : émettre pour tous */}
          <button onClick={mintAll} disabled={busy === "mint"}>
            {busy === "mint" ? "Minting…" : `Mint all (${c?.registered ?? 0} pending)`}
          </button>
          {/* Bouton secondaire : envoyer aux associés */}
          <button className="secondary" onClick={distribute} disabled={busy === "dist"}>
            {busy === "dist" ? "Sending…" : "Send to associated"}
          </button>
        </div>
      </div>

      {/* Bandeau des compteurs + boutons Rafraîchir / Tout effacer */}
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

      {/* La BARRE DE PROGRESSION (visible pendant/après l'émission) */}
      {progress && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 8 }}>
            <span>{busy === "mint" ? "Minting certificates…" : "Minting complete"}</span>
            <b>{progress.done}/{progress.total}</b>
          </div>
          {/* La barre : sa largeur = pourcentage fait / total */}
          <div className="bar">
            <div
              className="bar-fill"
              style={{ width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%` }}
            />
          </div>
          {/* Le journal : chaque étudiant émis, du plus récent au plus ancien */}
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

      {/* Message de statut (succès / erreur / info) */}
      {msg && <div className={`result ${msg.type === "ok" ? "ok" : msg.type === "err" ? "err" : ""}`} style={msg.type === "info" ? { background: "#131a2c", border: "1px solid #263048" } : {}}>{msg.text}</div>}

      {/* Le TABLEAU des étudiants */}
      <div className="card" style={{ marginTop: 18 }}>
        <h2>Students</h2>
        <table className="tbl">
          <thead>
            <tr><th>Name</th><th>Account</th><th>Status</th><th>Serial</th></tr>
          </thead>
          <tbody>
            {/* Une ligne par étudiant */}
            {(data?.students || []).map((s) => (
              <tr key={s.accountId}>
                <td>{s.name}</td>
                <td className="mono">{s.accountId}</td>
                <td><span className={`pill ${s.status}`}>{s.status}</span></td>
                <td>{s.hashscan ? <a href={s.hashscan} target="_blank" rel="noreferrer">#{s.serial}</a> : "—"}</td>
              </tr>
            ))}
            {/* Message si aucun étudiant */}
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
