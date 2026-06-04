import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;
  const { id } = await params;

  const rows = await prisma.$queryRawUnsafe<{ sessionId: string }[]>(
    `SELECT "sessionId" FROM "WorkoutExercise" WHERE id = $1 AND "userId" = $2`,
    id, userId
  ).catch(() => [] as { sessionId: string }[]);

  if (rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const sessionId = rows[0].sessionId;

  await prisma.$executeRawUnsafe(`DELETE FROM "WorkoutExercise" WHERE id = $1`, id);

  await prisma.$executeRawUnsafe(
    `UPDATE "WorkoutSession" SET "kcalBurned" = (SELECT COALESCE(SUM("kcalBurned"),0) FROM "WorkoutExercise" WHERE "sessionId" = $1) WHERE id = $1`,
    sessionId
  );

  return new NextResponse(null, { status: 204 });
}
