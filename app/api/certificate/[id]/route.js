import { getCert } from "@/lib/db";
import { renderCertificateSVG } from "@/lib/certificate";

export const runtime = "nodejs";

// Renders the diploma image for a minted certificate from stored metadata.
export async function GET(_req, { params }) {
  const meta = await getCert(params.id);
  if (!meta) {
    return new Response("Not found", { status: 404 });
  }
  const p = meta.properties || {};
  const svg = renderCertificateSVG({
    student: p.student,
    course: p.course,
    issuer: p.issuer,
    date: p.issueDate,
    tokenId: p.tokenId,
    serial: p.serial,
  });
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
