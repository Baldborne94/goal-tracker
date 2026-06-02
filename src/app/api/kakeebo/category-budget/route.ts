import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const month = new URL(req.url).searchParams.get("month");
  if (!month) return NextResponse.json({ error: "month required" }, { status: 400 });
  const budgets = await prisma.$queryRawUnsafe<{ id: string; category: string; amount: number }[]>(
    `SELECT id, category, amount FROM "CategoryBudget" WHERE "userId" = $1 AND "month" = $2`,
    session.user.id, month
  );
  return NextResponse.json(budgets);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { month, category, amount } = await req.json();
  if (!month || !category || amount == null) return NextResponse.json({ error: "month, category, amount required" }, { status: 400 });

  const existing = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM "CategoryBudget" WHERE "userId" = $1 AND "month" = $2 AND "category" = $3 LIMIT 1`,
    session.user.id, month, category
  );

  if (existing.length > 0) {
    await prisma.$executeRawUnsafe(
      `UPDATE "CategoryBudget" SET "amount" = $1 WHERE "id" = $2`,
      amount, existing[0].id
    );
    return NextResponse.json({ id: existing[0].id, month, category, amount });
  }

  const id = `cb_${Math.random().toString(36).slice(2, 11)}`;
  await prisma.$executeRawUnsafe(
    `INSERT INTO "CategoryBudget" ("id","userId","month","category","amount") VALUES ($1,$2,$3,$4,$5)`,
    id, session.user.id, month, category, amount
  );
  return NextResponse.json({ id, month, category, amount }, { status: 201 });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { month, category } = await req.json();
  await prisma.$executeRawUnsafe(
    `DELETE FROM "CategoryBudget" WHERE "userId" = $1 AND "month" = $2 AND "category" = $3`,
    session.user.id, month, category
  );
  return NextResponse.json({ ok: true });
}
