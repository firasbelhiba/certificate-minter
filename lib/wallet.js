// ═══════════════════════════════════════════════════════════════════════════
//  lib/wallet.js — Connexion au portefeuille HashPack via Hedera WalletConnect
//  (OPTIONNEL : actif seulement si un identifiant de projet WalletConnect existe.)
//  Tout est importé "à la demande" (dynamic import) pour ne jamais s'exécuter
//  côté serveur pendant le build — ces outils n'existent que dans le navigateur.
// ═══════════════════════════════════════════════════════════════════════════

// On garde une seule instance du connecteur (mise en cache).
let _connector = null;

// extractAccountId() : récupère l'identifiant du compte depuis la session.
// Les comptes ont la forme "hedera:testnet:0.0.12345" → on garde la fin.
function extractAccountId(session) {
  const ns = session?.namespaces || {};
  for (const key of Object.keys(ns)) {
    const accounts = ns[key]?.accounts || [];
    if (accounts.length) return accounts[0].split(":").pop();
  }
  throw new Error("Could not read account from wallet session.");
}

// getConnector() : initialise le connecteur WalletConnect (une seule fois).
async function getConnector(config) {
  const projectId = config?.walletConnectProjectId; // l'ID de projet Reown
  if (!projectId) {
    throw new Error("Wallet connect is not configured (missing project id).");
  }
  if (_connector) return _connector; // déjà initialisé → on réutilise

  // Import à la demande des outils WalletConnect + du SDK Hedera.
  const {
    DAppConnector,
    HederaJsonRpcMethod,
    HederaSessionEvent,
    HederaChainId,
  } = await import("@hashgraph/hedera-wallet-connect");
  const { LedgerId } = await import("@hashgraph/sdk");

  // On choisit le réseau (testnet/mainnet).
  const network = (config?.network || "testnet").toLowerCase();
  const ledger = network === "mainnet" ? LedgerId.MAINNET : LedgerId.TESTNET;
  const chain =
    network === "mainnet" ? HederaChainId.Mainnet : HederaChainId.Testnet;

  // Les infos de notre application montrées dans le portefeuille.
  const meta = {
    name: "Course Certificates",
    description: "Claim your Hedera course certificate NFT",
    url: typeof window !== "undefined" ? window.location.origin : "",
    icons: [],
  };

  // On crée le connecteur avec toutes ces options.
  _connector = new DAppConnector(
    meta,
    ledger,
    projectId,
    Object.values(HederaJsonRpcMethod), // les méthodes autorisées
    [HederaSessionEvent.ChainChanged, HederaSessionEvent.AccountsChanged], // événements
    [chain] // le réseau
  );
  await _connector.init({ logger: "error" }); // on initialise
  return _connector;
}

// connectWallet() : ouvre la fenêtre de connexion et renvoie le compte connecté.
export async function connectWallet(config) {
  const connector = await getConnector(config);
  const session = await connector.openModal(); // ouvre la modale HashPack
  const accountId = extractAccountId(session); // récupère le compte
  return { accountId, connector };
}

// associateToken() : fait signer à l'étudiant l'association du jeton dans son portefeuille.
export async function associateToken(wallet, tokenId) {
  const { AccountId, TokenAssociateTransaction } = await import(
    "@hashgraph/sdk"
  );
  // On récupère le "signataire" (le portefeuille de l'étudiant).
  const signer = wallet.connector.getSigner(AccountId.fromString(wallet.accountId));
  // On prépare la transaction d'association du jeton.
  const tx = await new TokenAssociateTransaction()
    .setAccountId(wallet.accountId) // le compte qui associe
    .setTokenIds([tokenId]) // le jeton à associer
    .freezeWithSigner(signer); // on gèle avec le signataire
  return tx.executeWithSigner(signer); // le portefeuille signe et exécute
}
