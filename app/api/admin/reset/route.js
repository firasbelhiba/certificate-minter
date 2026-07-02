import { NextResponse } from "next/server";
import { checkAdmin } from "@/lib/auth";
import { clearAll } from "@/lib/db";

export const runtime = "nodejs";

// Wipes the student list + certificate records so a new class can start fresh.
export async function POST(req) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await clearAll();
  return NextResponse.json({ ok: true });
}
