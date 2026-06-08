import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { initGymTables } from "@/lib/init-tables";

export const runtime = "nodejs";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  await initGymTables();

  const { id } = await params;

  const existing = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM "GymLog" WHERE id = $1 AND "userId" = $2`,
    id, userId
  );
  if (existing.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.$executeRawUnsafe(`DELETE FROM "GymLog" WHERE id = $1`, id);

  return NextResponse.json({ ok: true });
}
