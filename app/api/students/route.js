import { NextResponse } from "next/server";
import { listStudents } from "@/lib/db";

export const runtime = "nodejs";

// Public: registered names + count (no full account IDs), for the student page.
export async function GET() {
  const all = await listStudents();
  return NextResponse.json({
    count: all.length,
    names: all.map((s) => s.name),
  });
}
