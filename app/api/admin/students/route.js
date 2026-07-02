// ═══════════════════════════════════════════════════════════════════════════
//  app/api/admin/students/route.js — La liste DÉTAILLÉE pour le formateur
//  (réservée à l'admin) : chaque étudiant + son statut + compteurs globaux.
// ═══════════════════════════════════════════════════════════════════════════
import { NextResponse } from "next/server";
import { checkAdmin } from "@/lib/auth";
import { listStudents } from "@/lib/db";
import { getHashScanBase } from "@/lib/hedera";

export const runtime = "nodejs";

// GET /api/admin/students (protégé par mot de passe)
export async function GET(req) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const all = await listStudents();
  const base = getHashScanBase();
  const tokenId = process.env.HEDERA_TOKEN_ID || "";
  // On transforme chaque étudiant en ligne d'affichage + lien HashScan, trié par nom.
  const students = all
    .map((s) => ({
      name: s.name,
      accountId: s.accountId,
      status: s.status,
      serial: s.serial || null,
      hashscan: s.serial ? `${base}/token/${tokenId}/${s.serial}` : null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name)); // tri alphabétique

  // On calcule les compteurs affichés dans le bandeau du dashboard.
  return NextResponse.json({
    tokenId,
    counts: {
      total: students.length,
      registered: students.filter((s) => s.status === "registered").length,
      minted: students.filter((s) => s.status === "minted").length,
      transferred: students.filter((s) => s.status === "transferred").length,
    },
    students,
  });
}
