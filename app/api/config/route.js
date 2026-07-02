// ═══════════════════════════════════════════════════════════════════════════
//  app/api/config/route.js — Expose la config PUBLIQUE (non secrète) à l'interface
//  ⚠️ Ne renvoie JAMAIS la clé privée. Le navigateur a juste besoin de savoir
//  le réseau, la collection, si l'admin/IPFS/WalletConnect sont configurés, etc.
// ═══════════════════════════════════════════════════════════════════════════
import { NextResponse } from "next/server";
import { getHashScanBase } from "@/lib/hedera";
import { ipfsEnabled } from "@/lib/ipfs";
import { adminConfigured } from "@/lib/auth";
import { storageMode } from "@/lib/db";

export const runtime = "nodejs";

// GET /api/config : renvoie les infos publiques.
export async function GET() {
  return NextResponse.json({
    network: (process.env.HEDERA_NETWORK || "testnet").toLowerCase(), // testnet/mainnet
    tokenId: process.env.HEDERA_TOKEN_ID || "", // la collection
    treasury: process.env.HEDERA_OPERATOR_ID || "", // le compte trésorerie (public)
    hasCredentials: Boolean(
      process.env.HEDERA_OPERATOR_ID && process.env.HEDERA_OPERATOR_KEY
    ), // les identifiants Hedera sont-ils présents ?
    adminConfigured: adminConfigured(), // un mot de passe admin existe-t-il ?
    ipfs: ipfsEnabled(), // IPFS activé ?
    storage: storageMode(), // "vercel-kv" ou "local-json"
    walletConnectProjectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || "", // WalletConnect (public)
    hashscan: getHashScanBase(), // URL de l'explorateur
  });
}
