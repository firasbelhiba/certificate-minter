// ═══════════════════════════════════════════════════════════════════════════
//  app/api/certificate/preview/route.js — Aperçu EN DIRECT du diplôme
//  Dessine un certificat à partir des paramètres d'URL, SANS rien émettre ni
//  enregistrer. Utilisé pour prévisualiser le rendu pendant la saisie.
// ═══════════════════════════════════════════════════════════════════════════
import { renderCertificateSVG } from "@/lib/certificate";

export const runtime = "nodejs";

// GET /api/certificate/preview?student=...&course=...
export async function GET(req) {
  // On lit les paramètres de l'URL.
  const q = new URL(req.url).searchParams;
  // On génère le SVG directement (aucune sauvegarde).
  const svg = renderCertificateSVG({
    student: q.get("student"),
    course: q.get("course"),
    issuer: q.get("issuer"),
    date: q.get("date"),
  });
  // no-store : on ne met pas en cache (l'aperçu change à chaque frappe).
  return new Response(svg, {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store" },
  });
}
