import { NextResponse } from "next/server";
import { getCert } from "@/lib/db";

export const runtime = "nodejs";

// Serves HIP-412 metadata JSON that the on-chain metadata points to.
export async function GET(_req, { params }) {
  const meta = await getCert(params.id);
  if (!meta) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(meta, {
    headers: { "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
