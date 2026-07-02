import { renderCertificateSVG } from "@/lib/certificate";

export const runtime = "nodejs";

// Live preview: renders a diploma from query params without minting or storing.
export async function GET(req) {
  const q = new URL(req.url).searchParams;
  const svg = renderCertificateSVG({
    student: q.get("student"),
    course: q.get("course"),
    issuer: q.get("issuer"),
    date: q.get("date"),
  });
  return new Response(svg, {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store" },
  });
}
