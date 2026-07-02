"use client"; // composant interactif (s'exécute dans le navigateur)

// ═══════════════════════════════════════════════════════════════════════════
//  app/page.js — La page ÉTUDIANT (page d'accueil "/")
//  Deux parties : 1) s'inscrire (nom + compte)  2) réclamer son certificat.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { connectWallet, associateToken } from "@/lib/wallet"; // connexion HashPack (optionnelle)

export default function Home() {
  // ─── Les états de la page ───
  const [config, setConfig] = useState(null); // config publique
  const [count, setCount] = useState(0); // nombre d'étudiants inscrits

  const [name, setName] = useState(""); // le nom saisi
  const [accountId, setAccountId] = useState(""); // l'identifiant de compte saisi
  const [wallet, setWallet] = useState(null); // infos du portefeuille connecté
  const [busy, setBusy] = useState(""); // action en cours
  const [msg, setMsg] = useState(null); // message affiché
  const [status, setStatus] = useState(null); // statut de l'étudiant (registered/minted...)

  // Au chargement : on récupère la config, le compteur, et le compte mémorisé.
  useEffect(() => {
    fetch("/api/config").then((r) => r.json()).then(setConfig).catch(() => {});
    refreshCount();
    const saved =
      typeof window !== "undefined"
        ? window.localStorage.getItem("cert_account")
        : "";
    if (saved) setAccountId(saved);
  }, []);

  // Récupère le nombre d'étudiants inscrits (affiché sous le titre).
  function refreshCount() {
    fetch("/api/students")
      .then((r) => r.json())
      .then((d) => setCount(d.count || 0))
      .catch(() => {});
  }

  // Petit raccourci pour afficher un message (type = ok/err/info).
  function say(type, text) {
    setMsg({ type, text });
  }

  // ─── Connexion du portefeuille (seulement si WalletConnect est configuré) ───
  async function onConnect() {
    setBusy("connect");
    say("info", "Opening wallet…");
    try {
      const w = await connectWallet(config); // ouvre HashPack
      setWallet(w);
      setAccountId(w.accountId); // remplit automatiquement le compte
      say("ok", `Connected: ${w.accountId}`);
    } catch (e) {
      say("err", e.message || "Wallet connection failed. You can paste your account ID instead.");
    } finally {
      setBusy("");
    }
  }

  // ─── Inscription : envoie nom + compte au serveur ───
  async function onRegister(e) {
    e.preventDefault(); // empêche le rechargement de la page
    setBusy("register");
    setMsg(null);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, accountId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Registration failed");
      window.localStorage.setItem("cert_account", accountId); // on mémorise le compte
      say("ok", "You're registered! Come back to claim your certificate once your instructor mints it.");
      refreshCount();
      checkStatus(); // on affiche tout de suite le statut
    } catch (e) {
      say("err", e.message);
    } finally {
      setBusy("");
    }
  }

  // ─── Vérifier le statut : où en est mon certificat ? ───
  async function checkStatus() {
    const id = accountId.trim();
    if (!id) return;
    setBusy("status");
    try {
      const res = await fetch(`/api/status?accountId=${encodeURIComponent(id)}`);
      const data = await res.json();
      setStatus(data.found ? data : { found: false });
    } catch (e) {
      say("err", e.message);
    } finally {
      setBusy("");
    }
  }

  // ─── Réclamer le certificat (le recevoir dans son portefeuille) ───
  async function onClaim() {
    setBusy("claim");
    setMsg(null);
    try {
      // 1) On tente le transfert (marche direct si déjà associé).
      let res = await fetch("/api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId }),
      });
      let data = await res.json();

      // 2) Si l'association manque : on la fait signer dans le portefeuille, puis on réessaie.
      if (data.needsAssociation) {
        if (!wallet) {
          // Sans portefeuille connecté : on explique comment associer manuellement.
          say(
            "info",
            `Associate token ${data.tokenId} in your wallet (HashPack → account → associate token), then click Claim again.`
          );
          setBusy("");
          return;
        }
        say("info", "Approve the token association in your wallet…");
        await associateToken(wallet, data.tokenId); // signe l'association
        // On laisse quelques secondes au mirror node, puis on réessaie.
        await new Promise((r) => setTimeout(r, 4000));
        res = await fetch("/api/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountId }),
        });
        data = await res.json();
      }

      if (!res.ok) throw new Error(data.error || "Claim failed");
      if (data.ok) {
        // Succès : le NFT est maintenant dans le portefeuille de l'étudiant.
        say("ok", `🎉 Certificate received! Serial #${data.serial}. It's now in your wallet.`);
        checkStatus();
      } else {
        say("info", data.message || "Try again shortly.");
      }
    } catch (e) {
      say("err", e.message);
    } finally {
      setBusy("");
    }
  }

  const net = config?.network || "testnet"; // le réseau (testnet)
  const wcReady = Boolean(config?.walletConnectProjectId); // WalletConnect actif ?

  return (
    <div className="wrap">
      {/* En-tête : titre + nombre d'inscrits */}
      <div className="header">
        <h1>🎓 Course Certificates on Hedera</h1>
        <p>
          Register your wallet to receive your end-of-course certificate as an
          NFT on Hedera <b style={{ color: "#00c2ff" }}>{net}</b>.
        </p>
        <p style={{ color: "#8a95ad", fontSize: 13, marginTop: 4 }}>
          {count} student{count === 1 ? "" : "s"} registered
        </p>
      </div>

      <div className="grid">
        {/* ─── Carte 1 : Inscription ─── */}
        <div className="card">
          <h2>1 · Register</h2>
          <div className="sub">
            {wcReady
              ? "Connect your wallet or paste your account ID."
              : "Enter your name and Hedera account ID."}
          </div>

          {/* Bouton "Connecter le portefeuille" : affiché seulement si WalletConnect est configuré */}
          {wcReady && (
            <button
              className="secondary"
              onClick={onConnect}
              disabled={busy === "connect"}
            >
              {busy === "connect" ? "Connecting…" : wallet ? `Connected · ${wallet.accountId}` : "Connect wallet (HashPack)"}
            </button>
          )}

          {/* Le formulaire d'inscription */}
          <form onSubmit={onRegister}>
            <label>Full name (as it should appear on the certificate) *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ada Lovelace" required />

            <label>Hedera account ID *</label>
            <input value={accountId} onChange={(e) => setAccountId(e.target.value)} placeholder="0.0.12345" required />

            <button type="submit" disabled={busy === "register"}>
              {busy === "register" ? "Registering…" : "Register"}
            </button>
          </form>
        </div>

        {/* ─── Carte 2 : Réclamation ─── */}
        <div className="card">
          <h2>2 · Claim your certificate</h2>
          <div className="sub">After your instructor mints, claim it here.</div>

          <label>Your account ID</label>
          <input value={accountId} onChange={(e) => setAccountId(e.target.value)} placeholder="0.0.12345" />

          {/* Bouton "Vérifier mon statut" */}
          <button className="secondary" onClick={checkStatus} disabled={busy === "status"}>
            {busy === "status" ? "Checking…" : "Check my status"}
          </button>

          {/* Affichage du statut trouvé */}
          {status && status.found && (
            <div className="token-badge" style={{ marginTop: 14 }}>
              <div>Name: <b>{status.name}</b></div>
              <div>Status: <b style={{ color: "#00c2ff" }}>{status.status}</b></div>
              {status.serial && <div>Serial: <b>#{status.serial}</b></div>}
            </div>
          )}
          {/* Compte non trouvé */}
          {status && !status.found && (
            <div className="token-badge" style={{ marginTop: 14 }}>
              Not registered yet with this account ID.
            </div>
          )}

          {/* Si le certificat est émis (minted) : instructions + bouton Réclamer */}
          {status && status.found && status.status === "minted" && (
            <>
              {!wcReady && (
                <div className="token-badge" style={{ marginTop: 12 }}>
                  Your certificate is ready! To receive it:
                  <br />
                  1. In your wallet (e.g. HashPack), <b>associate token{" "}
                  <span className="mono">{status.tokenId}</span></b>.
                  <br />
                  2. Come back and click the button below.
                </div>
              )}
              <button onClick={onClaim} disabled={busy === "claim"}>
                {busy === "claim"
                  ? "Claiming…"
                  : wcReady
                  ? "Associate & Claim"
                  : "Claim my certificate"}
              </button>
            </>
          )}
          {/* Si déjà reçu (transferred) : lien HashScan */}
          {status && status.found && status.status === "transferred" && (
            <div className="result ok" style={{ marginTop: 12 }}>
              ✅ Already in your wallet.{" "}
              {status.hashscan && (
                <a href={status.hashscan} target="_blank" rel="noreferrer">View on HashScan ↗</a>
              )}
            </div>
          )}
          {/* Si encore en attente d'émission (registered) */}
          {status && status.found && status.status === "registered" && (
            <div className="token-badge" style={{ marginTop: 12 }}>
              ⏳ Waiting for your instructor to mint. Check back soon.
            </div>
          )}
        </div>
      </div>

      {/* Message de statut global */}
      {msg && <div className={`result ${msg.type === "ok" ? "ok" : msg.type === "err" ? "err" : ""}`} style={msg.type === "info" ? { marginTop: 18, background: "#131a2c", border: "1px solid #263048" } : {}}>{msg.text}</div>}

      {/* Lien vers la section formateur */}
      <div className="foot">
        Instructor? Go to <a href="/admin" style={{ color: "#00c2ff" }}>/admin</a> · Powered by Hedera Token Service
      </div>
    </div>
  );
}
