import { NextResponse } from "next/server";
import { TransferTransaction } from "@hashgraph/sdk";
import { getStudent, patchStudent } from "@/lib/db";
import {
  getClient,
  getOperatorKey,
  isAssociated,
  getHashScanBase,
} from "@/lib/hedera";

export const runtime = "nodejs";

// Student self-claim: once their account has associated the token, transfer
// their certificate NFT from the treasury (operator) to them.
export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const accountId = (body.accountId || "").trim();
    const tokenId = process.env.HEDERA_TOKEN_ID;

    if (!tokenId) {
      return NextResponse.json(
        { error: "HEDERA_TOKEN_ID is not set." },
        { status: 400 }
      );
    }

    const student = await getStudent(accountId);
    if (!student) {
      return NextResponse.json(
        { error: "This account is not registered." },
        { status: 404 }
      );
    }
    if (student.status === "transferred") {
      return NextResponse.json({
        ok: true,
        alreadyClaimed: true,
        serial: student.serial,
        hashscan: `${getHashScanBase()}/token/${tokenId}/${student.serial}`,
      });
    }
    if (student.status !== "minted" || !student.serial) {
      return NextResponse.json(
        { error: "Your certificate hasn't been minted yet. Check back shortly." },
        { status: 409 }
      );
    }

    // The student must associate the token before we can transfer it to them.
    const associated = await isAssociated(accountId, tokenId);
    if (!associated) {
      return NextResponse.json({
        ok: false,
        needsAssociation: true,
        tokenId,
        message:
          "Associate this token in your wallet first, then claim again.",
      });
    }

    const client = getClient();
    const operatorKey = getOperatorKey();
    const treasury = process.env.HEDERA_OPERATOR_ID;

    const tx = await new TransferTransaction()
      .addNftTransfer(tokenId, Number(student.serial), treasury, accountId)
      .freezeWith(client);
    const signed = await tx.sign(operatorKey);
    const response = await signed.execute(client);
    await response.getReceipt(client);

    await patchStudent(accountId, { status: "transferred" });

    return NextResponse.json({
      ok: true,
      serial: student.serial,
      transactionId: response.transactionId.toString(),
      hashscan: `${getHashScanBase()}/token/${tokenId}/${student.serial}`,
    });
  } catch (err) {
    console.error("claim error:", err);
    return NextResponse.json(
      { error: err.message || "Claim failed" },
      { status: 500 }
    );
  }
}
