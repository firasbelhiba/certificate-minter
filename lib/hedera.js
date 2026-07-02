import { Client, PrivateKey, AccountId } from "@hashgraph/sdk";

/**
 * Build a Hedera client from the operator credentials in the environment.
 * Throws a clear error if credentials are missing so the UI can show it.
 */
export function getClient() {
  const network = (process.env.HEDERA_NETWORK || "testnet").toLowerCase();
  const operatorId = process.env.HEDERA_OPERATOR_ID;
  const operatorKey = process.env.HEDERA_OPERATOR_KEY;

  if (!operatorId || !operatorKey) {
    throw new Error(
      "Missing HEDERA_OPERATOR_ID or HEDERA_OPERATOR_KEY. Add them to .env.local and restart the dev server."
    );
  }

  const client =
    network === "mainnet" ? Client.forMainnet() : Client.forTestnet();

  client.setOperator(AccountId.fromString(operatorId), parseKey(operatorKey));
  return client;
}

/**
 * Accept whatever key format the user pastes from the Hedera portal:
 * DER-encoded (starts with 302e / 3030 / 302d), or raw hex, ED25519 or ECDSA.
 */
export function parseKey(raw) {
  const key = raw.trim();
  // DER-encoded keys are handled generically by fromStringDer.
  try {
    if (key.startsWith("302") || key.startsWith("303")) {
      return PrivateKey.fromStringDer(key);
    }
  } catch (_) {
    /* fall through to the attempts below */
  }
  // Try ED25519 first (default portal accounts), then ECDSA.
  try {
    return PrivateKey.fromStringED25519(key);
  } catch (_) {
    return PrivateKey.fromStringECDSA(key);
  }
}

export function getOperatorKey() {
  return parseKey(process.env.HEDERA_OPERATOR_KEY);
}

export function getMirrorNodeBase() {
  const network = (process.env.HEDERA_NETWORK || "testnet").toLowerCase();
  return network === "mainnet"
    ? "https://mainnet-public.mirrornode.hedera.com"
    : "https://testnet.mirrornode.hedera.com";
}

export function getHashScanBase() {
  const network = (process.env.HEDERA_NETWORK || "testnet").toLowerCase();
  return `https://hashscan.io/${network === "mainnet" ? "mainnet" : "testnet"}`;
}

// Resolves the app's own public base URL for on-chain metadata pointers.
// Explicit env wins; otherwise derive from the (proxied) request headers.
export function getBaseUrl(req) {
  const explicit = (process.env.NEXT_PUBLIC_BASE_URL || "").trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host =
    req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  if (host) return `${proto}://${host}`;
  return new URL(req.url).origin;
}

export function isValidAccountId(id) {
  return /^0\.0\.\d+$/.test(String(id || "").trim());
}

// Returns true if `accountId` has associated `tokenId` (via mirror node).
export async function isAssociated(accountId, tokenId) {
  const url = `${getMirrorNodeBase()}/api/v1/accounts/${accountId}/tokens?token.id=${tokenId}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return false;
  const data = await res.json();
  return Array.isArray(data.tokens) && data.tokens.length > 0;
}
