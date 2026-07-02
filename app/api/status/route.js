import { NextResponse } from "next/server";
import { getStudent } from "@/lib/db";
import { getHashScanBase } from "@/lib/hedera";

export const runtime = "nodejs";

// Student-facing status lookup by account ID.
export async function GET(req) {
  const accountId = (
    new URL(req.url).searchParams.get("accountId") || ""
  ).trim();
  if (!accountId) {
    return NextResponse.json({ error: "accountId required" }, { status: 400 });
  }
  const s = await getStudent(accountId);
  if (!s) {
    return NextResponse.json({ found: false });
  }
  const tokenId = process.env.HEDERA_TOKEN_ID || "";
  return NextResponse.json({
    found: true,
    name: s.name,
    accountId: s.accountId,
    status: s.status, // registered | minted | transferred
    serial: s.serial || null,
    tokenId,
    hashscan: s.serial
      ? `${getHashScanBase()}/token/${tokenId}/${s.serial}`
      : null,
  });
}
