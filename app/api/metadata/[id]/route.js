// ═══════════════════════════════════════════════════════════════════════════
//  app/api/metadata/[id]/route.js — Sert le JSON des métadonnées (standard HIP-412)
//  C'est ce fichier que le pointeur inscrit sur la blockchain va chercher
//  (quand on n'utilise pas IPFS). [id] = l'identifiant du certificat (certId).
// ═══════════════════════════════════════════════════════════════════════════
import { NextResponse } from "next/server";
import { getCert } from "@/lib/db";

export const runtime = "nodejs";

// GET /api/metadata/<certId>
export async function GET(_req, { params }) {
  // On récupère les métadonnées enregistrées pour ce certificat.
  const meta = await getCert(params.id);
  if (!meta) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  // On renvoie le JSON, avec un cache long (le contenu ne change pas).
  return NextResponse.json(meta, {
    headers: { "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
