import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

async function ensureColumn() {
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "kcalGoal" INTEGER DEFAULT 2000`
  );
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.$queryRawUnsafe<{ kcalGoal: number | null }[]>(
    `SELECT "kcalGoal" FROM "User" WHERE id = $1`, session.user.id
  ).catch(async () => {
    await ensureColumn().catch(() => {});
    return [] as { kcalGoal: number | null }[];
  });

  return NextResponse.json({ kcalGoal: rows[0]?.kcalGoal ?? 2000 });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const { kcalGoal } = await req.json().catch(() => ({})) as { kcalGoal?: number };
  if (typeof kcalGoal !== "number" || kcalGoal < 500 || kcalGoal > 10000) {
    return NextResponse.json({ error: "kcalGoal must be between 500 and 10000" }, { status: 400 });
  }

  await prisma.$executeRawUnsafe(
    `UPDATE "User" SET "kcalGoal" = $1 WHERE id = $2`, kcalGoal, userId
  ).catch(async () => {
    await ensureColumn();
    await prisma.$executeRawUnsafe(
      `UPDATE "User" SET "kcalGoal" = $1 WHERE id = $2`, kcalGoal, userId
    );
  });

  return NextResponse.json({ kcalGoal });
}
