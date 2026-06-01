import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.expense.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing)
    return NextResponse.json({ error: "Expense not found" }, { status: 404 });

  await prisma.expense.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { amount, category, description, merchant, date } = await req.json();

  const existing = await prisma.expense.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing)
    return NextResponse.json({ error: "Expense not found" }, { status: 404 });

  const updated = await prisma.expense.update({
    where: { id },
    data: {
      ...(amount !== undefined && { amount: parseFloat(String(amount)) }),
      ...(category !== undefined && { category }),
      ...(description !== undefined && { description: description || null }),
      ...(merchant !== undefined && { merchant: merchant || null }),
      ...(date !== undefined && { date: new Date(date) }),
    },
  });

  return NextResponse.json(updated);
}
