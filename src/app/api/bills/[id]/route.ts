import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

type Bill = { id: string; title: string; amount: number; dueDay: number; category: string; notifyDaysBefore: number; active: boolean };

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.$executeRawUnsafe(
    `DELETE FROM "RecurringBill" WHERE id = $1 AND "userId" = $2`,
    id, session.user.id
  );
  return NextResponse.json({ ok: true });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  if (typeof body.active === "boolean") {
    await prisma.$executeRawUnsafe(
      `UPDATE "RecurringBill" SET active = $1 WHERE id = $2 AND "userId" = $3`,
      body.active, id, session.user.id
    );
  }

  const [bill] = await prisma.$queryRawUnsafe<Bill[]>(
    `SELECT id, title, amount, "dueDay", category, "notifyDaysBefore", active FROM "RecurringBill" WHERE id = $1 AND "userId" = $2`,
    id, session.user.id
  );
  return NextResponse.json(bill ?? { ok: true });
}
