import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { claimBoss, getBossProgress } from "@/lib/boss-server";

export const runtime = "nodejs";

// GET /api/boss — il boss di questa settimana e a che punto sei.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json(await getBossProgress(session.user.id));
}

// POST /api/boss — riscuote la vittoria, se tutte e tre le condizioni sono soddisfatte.
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await claimBoss(session.user.id);
  if (!result.ok) {
    const status = result.reason === "error" ? 500 : 400;
    return NextResponse.json({ error: result.reason }, { status });
  }

  return NextResponse.json(result);
}
