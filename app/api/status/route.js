// ═══════════════════════════════════════════════════════════════════════════
//  app/api/status/route.js — Où en est le certificat d'un étudiant ?
//  L'étudiant fournit son identifiant de compte, on renvoie son statut.
// ═══════════════════════════════════════════════════════════════════════════
import { NextResponse } from "next/server";
import { getStudent } from "@/lib/db";
import { getHashScanBase } from "@/lib/hedera";

export const runtime = "nodejs";

// GET /api/status?accountId=0.0.XXXXX
export async function GET(req) {
  // On lit l'identifiant de compte depuis les paramètres de l'URL.
  const accountId = (
    new URL(req.url).searchParams.get("accountId") || ""
  ).trim();
  if (!accountId) {
    return NextResponse.json({ error: "accountId required" }, { status: 400 });
  }
  // On cherche l'étudiant dans la base.
  const s = await getStudent(accountId);
  if (!s) {
    return NextResponse.json({ found: false }); // pas inscrit
  }
  const tokenId = process.env.HEDERA_TOKEN_ID || "";
  // On renvoie son statut + un lien HashScan si le NFT existe déjà.
  return NextResponse.json({
    found: true,
    name: s.name,
    accountId: s.accountId,
    status: s.status, // registered (inscrit) | minted (émis) | transferred (reçu)
    serial: s.serial || null, // le numéro de série du NFT
    tokenId,
    hashscan: s.serial
      ? `${getHashScanBase()}/token/${tokenId}/${s.serial}`
      : null,
  });
}
