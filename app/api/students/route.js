// ═══════════════════════════════════════════════════════════════════════════
//  app/api/students/route.js — Liste PUBLIQUE des inscrits (pour la page étudiant)
//  On renvoie seulement le nombre + les prénoms (pas les identifiants complets).
// ═══════════════════════════════════════════════════════════════════════════
import { NextResponse } from "next/server";
import { listStudents } from "@/lib/db";

export const runtime = "nodejs";

// GET /api/students : combien d'étudiants inscrits + leurs noms.
export async function GET() {
  const all = await listStudents();
  return NextResponse.json({
    count: all.length, // le compteur affiché sous le titre
    names: all.map((s) => s.name), // la liste des noms
  });
}
