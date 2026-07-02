// ═══════════════════════════════════════════════════════════════════════════
//  app/api/claim/route.js — La RÉCLAMATION : l'étudiant reçoit son NFT
//  On utilise TransferTransaction : elle déplace le NFT de la trésorerie
//  (le compte du formateur) vers le compte de l'étudiant.
// ═══════════════════════════════════════════════════════════════════════════
import { NextResponse } from "next/server"; // pour renvoyer des réponses JSON
import { TransferTransaction } from "@hashgraph/sdk"; // la transaction de transfert
import { getStudent, patchStudent } from "@/lib/db"; // accès base de données
import {
  getClient,
  getOperatorKey,
  isAssociated,
  getHashScanBase,
} from "@/lib/hedera";

// Cette route s'exécute côté serveur Node.js (pas dans le navigateur).
export const runtime = "nodejs";

/**
 * POST /api/claim : une fois que le compte de l'étudiant a associé le jeton,
 * on transfère son certificat NFT de la trésorerie vers lui.
 */
export async function POST(req) {
  try {
    // On lit le corps de la requête (l'identifiant de compte de l'étudiant).
    const body = await req.json().catch(() => ({}));
    const accountId = (body.accountId || "").trim();
    const tokenId = process.env.HEDERA_TOKEN_ID; // la collection

    // Sans collection configurée, on ne peut rien faire.
    if (!tokenId) {
      return NextResponse.json(
        { error: "HEDERA_TOKEN_ID is not set." },
        { status: 400 }
      );
    }

    // On retrouve l'étudiant dans la base.
    const student = await getStudent(accountId);
    if (!student) {
      // Compte inconnu → il ne s'est pas inscrit.
      return NextResponse.json(
        { error: "This account is not registered." },
        { status: 404 }
      );
    }
    // S'il a déjà reçu son certificat, on renvoie simplement le lien.
    if (student.status === "transferred") {
      return NextResponse.json({
        ok: true,
        alreadyClaimed: true,
        serial: student.serial,
        hashscan: `${getHashScanBase()}/token/${tokenId}/${student.serial}`,
      });
    }
    // Si le certificat n'a pas encore été émis, on demande de repasser plus tard.
    if (student.status !== "minted" || !student.serial) {
      return NextResponse.json(
        { error: "Your certificate hasn't been minted yet. Check back shortly." },
        { status: 409 }
      );
    }

    // ⚠️ Étape clé : l'étudiant doit avoir associé le jeton avant le transfert.
    const associated = await isAssociated(accountId, tokenId);
    if (!associated) {
      // Pas encore associé → on renvoie un signal pour l'inviter à le faire.
      return NextResponse.json({
        ok: false,
        needsAssociation: true,
        tokenId,
        message:
          "Associate this token in your wallet first, then claim again.",
      });
    }

    // On prépare le transfert : le formateur (trésorerie) est la source.
    const client = getClient();
    const operatorKey = getOperatorKey();
    const treasury = process.env.HEDERA_OPERATOR_ID;

    // TransferTransaction : on déplace le NFT (tokenId + numéro de série)
    // depuis la trésorerie vers le compte de l'étudiant.
    const tx = await new TransferTransaction()
      .addNftTransfer(tokenId, Number(student.serial), treasury, accountId)
      .freezeWith(client); // on gèle pour signer
    const signed = await tx.sign(operatorKey); // la trésorerie signe le départ
    const response = await signed.execute(client); // on envoie au réseau
    await response.getReceipt(client); // on attend la confirmation

    // On note dans la base que l'étudiant a bien reçu son certificat.
    await patchStudent(accountId, { status: "transferred" });

    // On renvoie le succès + le lien HashScan pour vérifier publiquement.
    return NextResponse.json({
      ok: true,
      serial: student.serial,
      transactionId: response.transactionId.toString(),
      hashscan: `${getHashScanBase()}/token/${tokenId}/${student.serial}`,
    });
  } catch (err) {
    // En cas d'erreur, on la journalise et on renvoie un message.
    console.error("claim error:", err);
    return NextResponse.json(
      { error: err.message || "Claim failed" },
      { status: 500 }
    );
  }
}
