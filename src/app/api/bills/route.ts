import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

type Bill = { id: string; title: string; amount: number; dueDay: number; category: string; notifyDaysBefore: number; active: boolean };

async function ensureTable() {
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "RecurringBill" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "dueDay" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "notifyDaysBefore" INTEGER NOT NULL DEFAULT 3,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecurringBill_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RecurringBill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`);
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const bills = await prisma.$queryRawUnsafe<Bill[]>(
      `SELECT id, title, amount, "dueDay", category, "notifyDaysBefore", active FROM "RecurringBill" WHERE "userId" = $1 ORDER BY "dueDay" ASC`,
      session.user.id
    );
    return NextResponse.json(bills);
  } catch {
    await ensureTable().catch(() => {});
    return NextResponse.json([]);
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { title, amount, dueDay, category, notifyDaysBefore = 3 } = await req.json();
  if (!title || !amount || !dueDay || !category) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const id = `bill_${Math.random().toString(36).slice(2, 11)}`;
  await ensureTable().catch(() => {});
  await prisma.$executeRawUnsafe(
    `INSERT INTO "RecurringBill" ("id","userId","title","amount","dueDay","category","notifyDaysBefore","active","createdAt") VALUES ($1,$2,$3,$4,$5,$6,$7,true,NOW())`,
    id, session.user.id, title, Number(amount), Number(dueDay), category, Number(notifyDaysBefore)
  );

  const [bill] = await prisma.$queryRawUnsafe<Bill[]>(
    `SELECT id, title, amount, "dueDay", category, "notifyDaysBefore", active FROM "RecurringBill" WHERE id = $1`,
    id
  );
  return NextResponse.json(bill);
}
