// ═══════════════════════════════════════════════════════════════════════════
//  app/api/create-token/route.js — Créer une nouvelle COLLECTION (le token NFT)
//  C'est l'étape faite UNE seule fois : on crée le jeton non-fongible qui
//  contiendra tous les certificats. Réservé au formateur (coûte des HBAR).
// ═══════════════════════════════════════════════════════════════════════════
import { NextResponse } from "next/server";
import {
  TokenCreateTransaction, // la transaction de création de jeton
  TokenType, // le type de jeton (fongible ou non)
  TokenSupplyType, // l'offre (fixe ou infinie)
} from "@hashgraph/sdk";
import { getClient, getOperatorKey, getHashScanBase } from "@/lib/hedera";
import { checkAdmin } from "@/lib/auth";

export const runtime = "nodejs";

// POST /api/create-token
export async function POST(req) {
  try {
    // Seul le formateur peut créer une collection.
    if (!checkAdmin(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Nom et symbole de la collection (avec des valeurs par défaut).
    const body = await req.json().catch(() => ({}));
    const name = (body.name || "Course Completion Certificate").slice(0, 100);
    const symbol = (body.symbol || "CERT").slice(0, 20);

    const client = getClient();
    const operatorId = process.env.HEDERA_OPERATOR_ID; // le compte trésorerie
    const supplyKey = getOperatorKey(); // la clé qui pourra émettre

    // On configure la création du jeton NFT.
    const tx = await new TokenCreateTransaction()
      .setTokenName(name) // nom de la collection
      .setTokenSymbol(symbol) // symbole (ex: CERT)
      .setTokenType(TokenType.NonFungibleUnique) // NON-FONGIBLE = NFT
      .setSupplyType(TokenSupplyType.Infinite) // on peut émettre autant qu'on veut
      .setInitialSupply(0) // 0 au départ (aucun NFT encore émis)
      .setTreasuryAccountId(operatorId) // la trésorerie = le formateur
      .setSupplyKey(supplyKey.publicKey) // qui a le droit d'émettre
      .setAdminKey(supplyKey.publicKey) // qui a le droit d'administrer le jeton
      .freezeWith(client); // on gèle pour signer

    const signed = await tx.sign(supplyKey); // on signe
    const response = await signed.execute(client); // on envoie
    const receipt = await response.getReceipt(client); // on attend le reçu
    const tokenId = receipt.tokenId.toString(); // l'ID de la nouvelle collection !

    // On renvoie l'ID + un lien HashScan.
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
