"use client";

import { useEffect, useState } from "react";
import { connectWallet, associateToken } from "@/lib/wallet";

export default function Home() {
  const [config, setConfig] = useState(null);
  const [count, setCount] = useState(0);

  const [name, setName] = useState("");
  const [accountId, setAccountId] = useState("");
  const [wallet, setWallet] = useState(null); // connected session info
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState(null);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    fetch("/api/config").then((r) => r.json()).then(setConfig).catch(() => {});
    refreshCount();
    const saved =
      typeof window !== "undefined"
        ? window.localStorage.getItem("cert_account")
        : "";
    if (saved) setAccountId(saved);
  }, []);

  function refreshCount() {
    fetch("/api/students")
      .then((r) => r.json())
      .then((d) => setCount(d.count || 0))
      .catch(() => {});
  }

  function say(type, text) {
    setMsg({ type, text });
  }

  async function onConnect() {
    setBusy("connect");
    say("info", "Opening wallet…");
    try {
      const w = await connectWallet(config);
      setWallet(w);
      setAccountId(w.accountId);
      say("ok", `Connected: ${w.accountId}`);
    } catch (e) {
      say("err", e.message || "Wallet connection failed. You can paste your account ID instead.");
    } finally {
      setBusy("");
    }
  }

  async function onRegister(e) {
    e.preventDefault();
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
      window.localStorage.setItem("cert_account", accountId);
      say("ok", "You're registered! Come back to claim your certificate once your instructor mints it.");
      refreshCount();
      checkStatus();
    } catch (e) {
      say("err", e.message);
    } finally {
      setBusy("");
    }
  }

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

  async function onClaim() {
    setBusy("claim");
    setMsg(null);
    try {
      // 1) transfer if already associated
      let res = await fetch("/api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId }),
      });
      let data = await res.json();

      // 2) needs association → sign it in the wallet, then claim again
      if (data.needsAssociation) {
        if (!wallet) {
          say(
            "info",
            `Associate token ${data.tokenId} in your wallet (HashPack → account → associate token), then click Claim again.`
          );
          setBusy("");
          return;
        }
        say("info", "Approve the token association in your wallet…");
        await associateToken(wallet, data.tokenId);
        // give the mirror node a moment, then retry
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

  const net = config?.network || "testnet";
  const wcReady = Boolean(config?.walletConnectProjectId);

  return (
    <div className="wrap">
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
        {/* Register */}
        <div className="card">
          <h2>1 · Register</h2>
          <div className="sub">
            {wcReady
              ? "Connect your wallet or paste your account ID."
              : "Enter your name and Hedera account ID."}
          </div>

          {wcReady && (
            <button
              className="secondary"
              onClick={onConnect}
              disabled={busy === "connect"}
            >
              {busy === "connect" ? "Connecting…" : wallet ? `Connected · ${wallet.accountId}` : "Connect wallet (HashPack)"}
            </button>
          )}

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

        {/* Claim */}
        <div className="card">
          <h2>2 · Claim your certificate</h2>
          <div className="sub">After your instructor mints, claim it here.</div>

          <label>Your account ID</label>
          <input value={accountId} onChange={(e) => setAccountId(e.target.value)} placeholder="0.0.12345" />

          <button className="secondary" onClick={checkStatus} disabled={busy === "status"}>
            {busy === "status" ? "Checking…" : "Check my status"}
          </button>

          {status && status.found && (
            <div className="token-badge" style={{ marginTop: 14 }}>
              <div>Name: <b>{status.name}</b></div>
              <div>Status: <b style={{ color: "#00c2ff" }}>{status.status}</b></div>
              {status.serial && <div>Serial: <b>#{status.serial}</b></div>}
            </div>
          )}
          {status && !status.found && (
            <div className="token-badge" style={{ marginTop: 14 }}>
              Not registered yet with this account ID.
            </div>
          )}

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
          {status && status.found && status.status === "transferred" && (
            <div className="result ok" style={{ marginTop: 12 }}>
              ✅ Already in your wallet.{" "}
              {status.hashscan && (
                <a href={status.hashscan} target="_blank" rel="noreferrer">View on HashScan ↗</a>
              )}
            </div>
          )}
          {status && status.found && status.status === "registered" && (
            <div className="token-badge" style={{ marginTop: 12 }}>
              ⏳ Waiting for your instructor to mint. Check back soon.
            </div>
          )}
        </div>
      </div>

      {msg && <div className={`result ${msg.type === "ok" ? "ok" : msg.type === "err" ? "err" : ""}`} style={msg.type === "info" ? { marginTop: 18, background: "#131a2c", border: "1px solid #263048" } : {}}>{msg.text}</div>}

      <div className="foot">
        Instructor? Go to <a href="/admin" style={{ color: "#00c2ff" }}>/admin</a> · Powered by Hedera Token Service
      </div>
    </div>
  );
}
