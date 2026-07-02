import { NextResponse } from "next/server";
import { TransferTransaction } from "@hashgraph/sdk";
import { checkAdmin } from "@/lib/auth";
import { listStudents, patchStudent } from "@/lib/db";
import { getClient, getOperatorKey, isAssociated } from "@/lib/hedera";

export const runtime = "nodejs";
export const maxDuration = 300;

// Transfers certificates to every minted student that has associated the token.
export async function POST(req) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const tokenId = process.env.HEDERA_TOKEN_ID;
  const treasury = process.env.HEDERA_OPERATOR_ID;
  if (!tokenId) {
    return NextResponse.json({ error: "HEDERA_TOKEN_ID not set." }, { status: 400 });
  }

  const client = getClient();
  const operatorKey = getOperatorKey();

  const all = await listStudents();
  const pending = all.filter((s) => s.status === "minted" && s.serial);
  const BATCH = 5;
  const batch = pending.slice(0, BATCH);

  const results = await Promise.all(
    batch.map(async (s) => {
      try {
        if (!(await isAssociated(s.accountId, tokenId))) {
          return { accountId: s.accountId, name: s.name, sent: false, reason: "not associated" };
        }
        const tx = await new TransferTransaction()
          .addNftTransfer(tokenId, Number(s.serial), treasury, s.accountId)
          .freezeWith(client);
        const signed = await tx.sign(operatorKey);
        const response = await signed.execute(client);
        await response.getReceipt(client);
        await patchStudent(s.accountId, { status: "transferred" });
        return { accountId: s.accountId, name: s.name, sent: true, serial: s.serial };
      } catch (err) {
        console.error("distribute error", s.accountId, err);
        return { accountId: s.accountId, name: s.name, sent: false, reason: err.message };
      }
    })
  );

  const sent = results.filter((r) => r.sent).length;
  return NextResponse.json({
    sent,
    notAssociated: results.filter((r) => !r.sent).length,
    remaining: Math.max(0, pending.length - batch.length),
    results,
  });
}
