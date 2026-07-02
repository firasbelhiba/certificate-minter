// ═══════════════════════════════════════════════════════════════════════════
//  app/api/register/route.js — L'INSCRIPTION d'un étudiant
//  L'étudiant envoie son nom + son identifiant de compte Hedera. On l'enregistre
//  dans la base avec le statut "registered" (inscrit, en attente d'émission).
// ═══════════════════════════════════════════════════════════════════════════
import { NextResponse } from "next/server";
import { upsertStudent, getStudent } from "@/lib/db";
import { isValidAccountId } from "@/lib/hedera"; // valide le format 0.0.XXXXX

export const runtime = "nodejs";

// POST /api/register : enregistre (ou met à jour) un étudiant.
export async function POST(req) {
  try {
    // On lit le nom et l'identifiant de compte envoyés par le formulaire.
    const body = await req.json().catch(() => ({}));
    const name = (body.name || "").trim();
    const accountId = (body.accountId || "").trim();

    // Le nom est obligatoire.
    if (!name) {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }
    // L'identifiant doit être un vrai compte Hedera (0.0.XXXXX).
    if (!isValidAccountId(accountId)) {
      return NextResponse.json(
        { error: "A valid Hedera account ID (e.g. 0.0.12345) is required." },
        { status: 400 }
      );
    }

    // Si ce compte a DÉJÀ reçu son certificat, on refuse une ré-inscription.
    const existing = await getStudent(accountId);
    if (existing && existing.status === "transferred") {
      return NextResponse.json(
        { error: "This account has already received its certificate." },
        { status: 409 }
      );
    }

    // On enregistre l'étudiant (on garde son statut existant s'il y en a un).
    const student = await upsertStudent({
      accountId,
      name,
      status: existing?.status || "registered",
    });

    // On renvoie le succès.
    return NextResponse.json({ ok: true, student });
  } catch (err) {
    console.error("register error:", err);
    return NextResponse.json(
      { error: err.message || "Registration failed" },
      { status: 500 }
    );
  }
}
