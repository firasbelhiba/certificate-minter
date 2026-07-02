// ═══════════════════════════════════════════════════════════════════════════
//  lib/hedera.js — Tout ce qui concerne la connexion au réseau Hedera
//  On importe 3 outils du SDK officiel Hedera :
//   - Client     : l'objet qui parle au réseau
//   - PrivateKey : pour manipuler une clé privée
//   - AccountId  : pour manipuler un identifiant de compte (ex: 0.0.1234)
// ═══════════════════════════════════════════════════════════════════════════
import { Client, PrivateKey, AccountId } from "@hashgraph/sdk";

/**
 * getClient() : construit le "client" Hedera à partir des identifiants du
 * formateur (l'operator). C'est cet objet qui signe et envoie les transactions.
 */
export function getClient() {
  // On lit le réseau choisi (testnet par défaut) depuis les variables d'env.
  const network = (process.env.HEDERA_NETWORK || "testnet").toLowerCase();
  // L'identifiant du compte du formateur (ex: 0.0.3700702).
  const operatorId = process.env.HEDERA_OPERATOR_ID;
  // La clé privée du formateur (secrète, jamais envoyée au navigateur).
  const operatorKey = process.env.HEDERA_OPERATOR_KEY;

  // Si l'un des deux manque, on arrête tout de suite avec un message clair.
  if (!operatorId || !operatorKey) {
    throw new Error(
      "Missing HEDERA_OPERATOR_ID or HEDERA_OPERATOR_KEY. Add them to .env.local and restart the dev server."
    );
  }

  // On crée le client selon le réseau : mainnet (réel) ou testnet (test).
  const client =
    network === "mainnet" ? Client.forMainnet() : Client.forTestnet();

  // On dit au client "voici qui paie et signe" : l'identifiant + la clé.
  client.setOperator(AccountId.fromString(operatorId), parseKey(operatorKey));
  // On renvoie le client prêt à l'emploi.
  return client;
}

/**
 * parseKey() : accepte n'importe quel format de clé collé depuis le portail
 * Hedera — encodée DER (commence par 302e/3030/302d) ou en hexadécimal brut,
 * qu'elle soit de type ED25519 ou ECDSA.
 */
export function parseKey(raw) {
  // On enlève les espaces autour de la clé.
  const key = raw.trim();
  // Les clés encodées DER commencent par "302" ou "303" → format générique.
  try {
    if (key.startsWith("302") || key.startsWith("303")) {
      return PrivateKey.fromStringDer(key);
    }
  } catch (_) {
    /* si ça échoue, on essaie les formats ci-dessous */
  }
  // On tente d'abord ED25519 (comptes du portail par défaut), puis ECDSA.
  try {
    return PrivateKey.fromStringED25519(key);
  } catch (_) {
    return PrivateKey.fromStringECDSA(key);
  }
}

/**
 * getOperatorKey() : renvoie la clé privée du formateur, déjà décodée.
 * Utilisée pour signer les transactions (mint, transfert...).
 */
export function getOperatorKey() {
  return parseKey(process.env.HEDERA_OPERATOR_KEY);
}

/**
 * getMirrorNodeBase() : l'URL du "mirror node" — une API de LECTURE d'Hedera
 * qui permet de consulter l'état de la blockchain (soldes, NFT, associations...).
 */
export function getMirrorNodeBase() {
  const network = (process.env.HEDERA_NETWORK || "testnet").toLowerCase();
  return network === "mainnet"
    ? "https://mainnet-public.mirrornode.hedera.com"
    : "https://testnet.mirrornode.hedera.com";
}

/**
 * getHashScanBase() : l'URL de l'explorateur HashScan (le "block explorer"
 * d'Hedera) pour montrer publiquement un NFT ou un compte.
 */
export function getHashScanBase() {
  const network = (process.env.HEDERA_NETWORK || "testnet").toLowerCase();
  return `https://hashscan.io/${network === "mainnet" ? "mainnet" : "testnet"}`;
}

/**
 * getBaseUrl() : trouve l'adresse publique de NOTRE application (ex:
 * https://certificate-minter-pied.vercel.app). Elle sert de base au lien des
 * métadonnées écrit sur la blockchain.
 * - Si une variable d'env explicite existe, on l'utilise.
 * - Sinon on la déduit des en-têtes de la requête (utile derrière Vercel).
 */
export function getBaseUrl(req) {
  const explicit = (process.env.NEXT_PUBLIC_BASE_URL || "").trim();
  if (explicit) return explicit.replace(/\/$/, ""); // on enlève le "/" final
  const proto = req.headers.get("x-forwarded-proto") || "https"; // http/https
  const host =
    req.headers.get("x-forwarded-host") || req.headers.get("host") || ""; // domaine
  if (host) return `${proto}://${host}`;
  return new URL(req.url).origin; // dernier recours
}

/**
 * isValidAccountId() : vérifie que la chaîne ressemble bien à un compte Hedera
 * de la forme 0.0.XXXXX (chiffres uniquement).
 */
export function isValidAccountId(id) {
  return /^0\.0\.\d+$/.test(String(id || "").trim());
}

/**
 * isAssociated() : renvoie vrai si le compte `accountId` a bien ASSOCIÉ le
 * jeton `tokenId`. On interroge le mirror node (lecture seule).
 * ⚠️ Règle Hedera : un compte doit associer un jeton AVANT de pouvoir le recevoir.
 */
export async function isAssociated(accountId, tokenId) {
  // On construit l'URL qui demande "ce compte a-t-il ce jeton ?".
  const url = `${getMirrorNodeBase()}/api/v1/accounts/${accountId}/tokens?token.id=${tokenId}`;
  // On appelle l'API sans cache (on veut l'état frais).
  const res = await fetch(url, { cache: "no-store" });
  // Si l'appel échoue, on considère "non associé".
  if (!res.ok) return false;
  // On lit la réponse JSON.
  const data = await res.json();
  // Si la liste des jetons n'est pas vide → le compte est associé.
  return Array.isArray(data.tokens) && data.tokens.length > 0;
}
