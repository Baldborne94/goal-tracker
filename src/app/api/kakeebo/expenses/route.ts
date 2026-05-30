import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkAndAwardKakeeboRewards } from "@/lib/rewards";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month") ?? new Date().toISOString().slice(0, 7);

  const [year, m] = month.split("-").map(Number);
  const start = new Date(year, m - 1, 1);
  const end = new Date(year, m, 1);

  const expenses = await prisma.expense.findMany({
    where: {
      userId: session.user.id,
      date: { gte: start, lt: end },
    },
    orderBy: { date: "desc" },
  });

  return NextResponse.json(expenses);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { amount, category, description, merchant, date } = await req.json();
  if (!amount || !category)
    return NextResponse.json({ error: "Amount and category are required" }, { status: 400 });

  const expense = await prisma.expense.create({
    data: {
      userId: session.user.id,
      amount: parseFloat(amount),
      category,
      description: description || null,
      merchant: merchant || null,
      date: date ? new Date(date) : new Date(),
    },
  });

  await checkAndAwardKakeeboRewards(session.user.id);

  return NextResponse.json(expense, { status: 201 });
}
