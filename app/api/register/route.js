import { NextResponse } from "next/server";
import { upsertStudent, getStudent } from "@/lib/db";
import { isValidAccountId } from "@/lib/hedera";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const name = (body.name || "").trim();
    const accountId = (body.accountId || "").trim();

    if (!name) {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }
    if (!isValidAccountId(accountId)) {
      return NextResponse.json(
        { error: "A valid Hedera account ID (e.g. 0.0.12345) is required." },
        { status: 400 }
      );
    }

    const existing = await getStudent(accountId);
    if (existing && existing.status === "transferred") {
      return NextResponse.json(
        { error: "This account has already received its certificate." },
        { status: 409 }
      );
    }

    const student = await upsertStudent({
      accountId,
      name,
      status: existing?.status || "registered",
    });

    return NextResponse.json({ ok: true, student });
  } catch (err) {
    console.error("register error:", err);
    return NextResponse.json(
      { error: err.message || "Registration failed" },
      { status: 500 }
    );
  }
}
