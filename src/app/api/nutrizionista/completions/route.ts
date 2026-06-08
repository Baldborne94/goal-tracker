import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { initNutrizionistaTables } from "@/lib/init-tables";

export const runtime = "nodejs";

type Row = { id: string; date: string; meal: string };

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await initNutrizionistaTables();

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  let rows: Row[];
  if (date) {
    rows = await prisma.$queryRawUnsafe<Row[]>(
      `SELECT id, date, meal FROM "MealCompletion" WHERE "userId" = $1 AND "date" = $2`,
      session.user.id, date
    );
  } else if (from && to) {
    rows = await prisma.$queryRawUnsafe<Row[]>(
      `SELECT id, date, meal FROM "MealCompletion" WHERE "userId" = $1 AND "date" >= $2 AND "date" <= $3`,
      session.user.id, from, to
    );
  } else {
    rows = await prisma.$queryRawUnsafe<Row[]>(
      `SELECT id, date, meal FROM "MealCompletion" WHERE "userId" = $1 ORDER BY "date" DESC LIMIT 200`,
      session.user.id
    );
  }

  return NextResponse.json({ completions: rows });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await initNutrizionistaTables();

  const { date, meal } = await req.json();
  if (!date || !meal) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const existing = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM "MealCompletion" WHERE "userId" = $1 AND "date" = $2 AND "meal" = $3`,
    session.user.id, date, meal
  );

  if (existing.length > 0) {
    await prisma.$executeRawUnsafe(
      `DELETE FROM "MealCompletion" WHERE "id" = $1`,
      existing[0].id
    );
    return NextResponse.json({ action: "removed" });
  }

  const id = `mc_${Math.random().toString(36).slice(2, 11)}`;
  await prisma.$executeRawUnsafe(
    `INSERT INTO "MealCompletion" ("id","userId","date","meal","createdAt") VALUES ($1,$2,$3,$4,NOW())`,
    id, session.user.id, date, meal
  );
  return NextResponse.json({ action: "added", id });
}
