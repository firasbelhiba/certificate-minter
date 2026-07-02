import { NextResponse } from "next/server";
import { checkAdmin } from "@/lib/auth";
import { listStudents } from "@/lib/db";
import { getHashScanBase } from "@/lib/hedera";

export const runtime = "nodejs";

export async function GET(req) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const all = await listStudents();
  const base = getHashScanBase();
  const tokenId = process.env.HEDERA_TOKEN_ID || "";
  const students = all
    .map((s) => ({
      name: s.name,
      accountId: s.accountId,
      status: s.status,
      serial: s.serial || null,
      hashscan: s.serial ? `${base}/token/${tokenId}/${s.serial}` : null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json({
    tokenId,
    counts: {
      total: students.length,
      registered: students.filter((s) => s.status === "registered").length,
      minted: students.filter((s) => s.status === "minted").length,
      transferred: students.filter((s) => s.status === "transferred").length,
    },
    students,
  });
}
