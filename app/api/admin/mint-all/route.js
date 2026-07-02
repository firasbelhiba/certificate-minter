import { NextResponse } from "next/server";
import { checkAdmin } from "@/lib/auth";
import { listStudents, patchStudent } from "@/lib/db";
import { getClient, getOperatorKey, getBaseUrl } from "@/lib/hedera";
import { mintCertificate } from "@/lib/mint";

export const runtime = "nodejs";
export const maxDuration = 300;

// Mints a certificate for every student that hasn't been minted yet.
export async function POST(req) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tokenId = process.env.HEDERA_TOKEN_ID;
  if (!tokenId) {
    return NextResponse.json(
      { error: "HEDERA_TOKEN_ID is not set on the server." },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const course = (body.course || "Course Completion").trim();
  const issuer = (body.issuer || "Academy").trim();
  const date = (body.date || new Date().toISOString().slice(0, 10)).trim();

  const baseUrl = getBaseUrl(req);

  const client = getClient();
  const supplyKey = getOperatorKey();

  const all = await listStudents();
  const pending = all.filter((s) => s.status === "registered");

  // Process a bounded batch in parallel so each call stays well under the
  // serverless time limit. The admin UI calls repeatedly until remaining = 0.
  const BATCH = 5;
  const batch = pending.slice(0, BATCH);

  const results = await Promise.all(
    batch.map(async (student) => {
      try {
        const r = await mintCertificate({
          client,
          supplyKey,
          tokenId,
          baseUrl,
          student,
          course,
          issuer,
          date,
        });
        await patchStudent(student.accountId, {
          status: "minted",
          certId: r.certId,
          serial: r.serial,
          course,
        });
        return { accountId: student.accountId, name: student.name, serial: r.serial, ok: true };
      } catch (err) {
        console.error("mint-all error for", student.accountId, err);
        return { accountId: student.accountId, name: student.name, ok: false, error: err.message };
      }
    })
  );

  const minted = results.filter((r) => r.ok).length;
  return NextResponse.json({
    minted,
    failed: results.filter((r) => !r.ok).length,
    remaining: Math.max(0, pending.length - batch.length),
    results,
  });
}
