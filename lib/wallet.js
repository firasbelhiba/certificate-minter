// Browser-only Hedera WalletConnect (HashPack) integration.
// Everything is dynamically imported so it never runs during SSR/build.

let _connector = null;

function extractAccountId(session) {
  // Accounts look like "hedera:testnet:0.0.12345"
  const ns = session?.namespaces || {};
  for (const key of Object.keys(ns)) {
    const accounts = ns[key]?.accounts || [];
    if (accounts.length) return accounts[0].split(":").pop();
  }
  throw new Error("Could not read account from wallet session.");
}

async function getConnector(config) {
  const projectId = config?.walletConnectProjectId;
  if (!projectId) {
    throw new Error("Wallet connect is not configured (missing project id).");
  }
  if (_connector) return _connector;

  const {
    DAppConnector,
    HederaJsonRpcMethod,
    HederaSessionEvent,
    HederaChainId,
  } = await import("@hashgraph/hedera-wallet-connect");
  const { LedgerId } = await import("@hashgraph/sdk");

  const network = (config?.network || "testnet").toLowerCase();
  const ledger = network === "mainnet" ? LedgerId.MAINNET : LedgerId.TESTNET;
  const chain =
    network === "mainnet" ? HederaChainId.Mainnet : HederaChainId.Testnet;

  const meta = {
    name: "Course Certificates",
    description: "Claim your Hedera course certificate NFT",
    url: typeof window !== "undefined" ? window.location.origin : "",
    icons: [],
  };

  _connector = new DAppConnector(
    meta,
    ledger,
    projectId,
    Object.values(HederaJsonRpcMethod),
    [HederaSessionEvent.ChainChanged, HederaSessionEvent.AccountsChanged],
    [chain]
  );
  await _connector.init({ logger: "error" });
  return _connector;
}

export async function connectWallet(config) {
  const connector = await getConnector(config);
  const session = await connector.openModal();
  const accountId = extractAccountId(session);
  return { accountId, connector };
}

export async function associateToken(wallet, tokenId) {
  const { AccountId, TokenAssociateTransaction } = await import(
    "@hashgraph/sdk"
  );
  const signer = wallet.connector.getSigner(AccountId.fromString(wallet.accountId));
  const tx = await new TokenAssociateTransaction()
    .setAccountId(wallet.accountId)
    .setTokenIds([tokenId])
    .freezeWithSigner(signer);
  return tx.executeWithSigner(signer);
}
