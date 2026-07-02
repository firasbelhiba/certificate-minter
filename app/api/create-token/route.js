import { NextResponse } from "next/server";
import {
  TokenCreateTransaction,
  TokenType,
  TokenSupplyType,
} from "@hashgraph/sdk";
import { getClient, getOperatorKey, getHashScanBase } from "@/lib/hedera";
import { checkAdmin } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    if (!checkAdmin(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json().catch(() => ({}));
    const name = (body.name || "Course Completion Certificate").slice(0, 100);
    const symbol = (body.symbol || "CERT").slice(0, 20);

    const client = getClient();
    const operatorId = process.env.HEDERA_OPERATOR_ID;
    const supplyKey = getOperatorKey();

    const tx = await new TokenCreateTransaction()
      .setTokenName(name)
      .setTokenSymbol(symbol)
      .setTokenType(TokenType.NonFungibleUnique)
      .setSupplyType(TokenSupplyType.Infinite)
      .setInitialSupply(0)
      .setTreasuryAccountId(operatorId)
      .setSupplyKey(supplyKey.publicKey)
      .setAdminKey(supplyKey.publicKey)
      .freezeWith(client);

    const signed = await tx.sign(supplyKey);
    const response = await signed.execute(client);
    const receipt = await response.getReceipt(client);
    const tokenId = receipt.tokenId.toString();

    return NextResponse.json({
      tokenId,
      name,
      symbol,
      hashscan: `${getHashScanBase()}/token/${tokenId}`,
    });
  } catch (err) {
    console.error("create-token error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to create token" },
      { status: 500 }
    );
  }
}
