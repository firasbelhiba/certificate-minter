// ═══════════════════════════════════════════════════════════════════════════
//  app/api/admin/verify/route.js — Vérifie le mot de passe formateur
//  Appelée par la page /admin pour valider la connexion avant d'afficher le
//  tableau de bord.
// ═══════════════════════════════════════════════════════════════════════════
import { NextResponse } from "next/server";
import { checkAdmin, adminConfigured } from "@/lib/auth";

export const runtime = "nodejs";

// POST /api/admin/verify (le mot de passe est dans l'en-tête x-admin-password)
export async function POST(req) {
  // Si aucun mot de passe n'est configuré sur le serveur → erreur.
  if (!adminConfigured()) {
    return NextResponse.json(
      { error: "ADMIN_PASSWORD is not set on the server." },
      { status: 500 }
    );
  }
  // Mauvais mot de passe → refusé.
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "Wrong password." }, { status: 401 });
  }
  // Bon mot de passe → OK.
  return NextResponse.json({ ok: true });
}
