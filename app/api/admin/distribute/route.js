// ═══════════════════════════════════════════════════════════════════════════
//  app/api/admin/distribute/route.js — Le formateur ENVOIE aux étudiants associés
//  Pour chaque étudiant "minted" qui a bien associé le jeton, on transfère son
//  certificat. Traité par lots de 5 (comme le mint) pour tenir dans le temps limite.
//  C'est une alternative au "Claim" fait par l'étudiant lui-même.
// ═══════════════════════════════════════════════════════════════════════════
import { NextResponse } from "next/server";
import { TransferTransaction } from "@hashgraph/sdk";
import { checkAdmin } from "@/lib/auth";
import { listStudents, patchStudent } from "@/lib/db";
import { getClient, getOperatorKey, isAssociated } from "@/lib/hedera";

export const runtime = "nodejs";
export const maxDuration = 300;

// POST /api/admin/distribute
export async function POST(req) {
  // Réservé au formateur.
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const tokenId = process.env.HEDERA_TOKEN_ID; // la collection
  const treasury = process.env.HEDERA_OPERATOR_ID; // la source (trésorerie)
  if (!tokenId) {
    return NextResponse.json({ error: "HEDERA_TOKEN_ID not set." }, { status: 400 });
  }

  const client = getClient();
  const operatorKey = getOperatorKey();

  // On garde les étudiants émis (minted) qui ont un numéro de série.
  const all = await listStudents();
  const pending = all.filter((s) => s.status === "minted" && s.serial);
  const BATCH = 5;
  const batch = pending.slice(0, BATCH);

  // On traite le lot en parallèle.
  const results = await Promise.all(
    batch.map(async (s) => {
      try {
        // On saute ceux qui n'ont pas encore associé le jeton.
        if (!(await isAssociated(s.accountId, tokenId))) {
          return { accountId: s.accountId, name: s.name, sent: false, reason: "not associated" };
        }
        // Transfert du NFT de la trésorerie vers l'étudiant.
        const tx = await new TransferTransaction()
          .addNftTransfer(tokenId, Number(s.serial), treasury, s.accountId)
          .freezeWith(client);
        const signed = await tx.sign(operatorKey);
        const response = await signed.execute(client);
        await response.getReceipt(client);
        // On note qu'il a reçu son certificat.
        await patchStudent(s.accountId, { status: "transferred" });
        return { accountId: s.accountId, name: s.name, sent: true, serial: s.serial };
      } catch (err) {
        console.error("distribute error", s.accountId, err);
        return { accountId: s.accountId, name: s.name, sent: false, reason: err.message };
      }
    })
  );

  // On renvoie combien envoyés, combien pas encore associés, et combien il reste.
  const sent = results.filter((r) => r.sent).length;
  return NextResponse.json({
    sent,
    notAssociated: results.filter((r) => !r.sent).length,
    remaining: Math.max(0, pending.length - batch.length),
    results,
  });
}
