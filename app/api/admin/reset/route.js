// ═══════════════════════════════════════════════════════════════════════════
//  app/api/admin/reset/route.js — Vider la base (bouton "Clear all students")
//  Efface la liste des étudiants + les enregistrements de certificats pour
//  repartir de zéro. Les NFT déjà sur la blockchain ne sont PAS touchés.
// ═══════════════════════════════════════════════════════════════════════════
import { NextResponse } from "next/server";
import { checkAdmin } from "@/lib/auth";
import { clearAll } from "@/lib/db";

export const runtime = "nodejs";

// POST /api/admin/reset (réservé au formateur)
export async function POST(req) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await clearAll(); // on vide la base
  return NextResponse.json({ ok: true });
}
