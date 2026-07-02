import { NextResponse } from "next/server";
import { getHashScanBase } from "@/lib/hedera";
import { ipfsEnabled } from "@/lib/ipfs";
import { adminConfigured } from "@/lib/auth";
import { storageMode } from "@/lib/db";

export const runtime = "nodejs";

// Non-secret config for the UI. Never exposes the private key.
export async function GET() {
  return NextResponse.json({
    network: (process.env.HEDERA_NETWORK || "testnet").toLowerCase(),
    tokenId: process.env.HEDERA_TOKEN_ID || "",
    treasury: process.env.HEDERA_OPERATOR_ID || "",
    hasCredentials: Boolean(
      process.env.HEDERA_OPERATOR_ID && process.env.HEDERA_OPERATOR_KEY
    ),
    adminConfigured: adminConfigured(),
    ipfs: ipfsEnabled(),
    storage: storageMode(),
    walletConnectProjectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || "",
    hashscan: getHashScanBase(),
  });
}
