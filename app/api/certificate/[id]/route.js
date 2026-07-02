// ═══════════════════════════════════════════════════════════════════════════
//  app/api/certificate/[id]/route.js — Sert l'IMAGE (SVG) d'un certificat émis
//  On relit les métadonnées stockées puis on redessine le diplôme à la volée.
// ═══════════════════════════════════════════════════════════════════════════
import { getCert } from "@/lib/db";
import { renderCertificateSVG } from "@/lib/certificate";

export const runtime = "nodejs";

// GET /api/certificate/<certId>
export async function GET(_req, { params }) {
  // On récupère les métadonnées du certificat.
  const meta = await getCert(params.id);
  if (!meta) {
    return new Response("Not found", { status: 404 });
  }
  // On extrait les propriétés (nom, cours...) pour dessiner le diplôme.
  const p = meta.properties || {};
  const svg = renderCertificateSVG({
    student: p.student,
    course: p.course,
    issuer: p.issuer,
    date: p.issueDate,
    tokenId: p.tokenId,
    serial: p.serial,
  });
  // On renvoie l'image avec le bon type MIME (image/svg+xml).
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
