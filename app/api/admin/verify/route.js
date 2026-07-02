import { NextResponse } from "next/server";
import { checkAdmin, adminConfigured } from "@/lib/auth";

export const runtime = "nodejs";

// Lets the admin page confirm the password before showing the dashboard.
export async function POST(req) {
  if (!adminConfigured()) {
    return NextResponse.json(
      { error: "ADMIN_PASSWORD is not set on the server." },
      { status: 500 }
    );
  }
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "Wrong password." }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
