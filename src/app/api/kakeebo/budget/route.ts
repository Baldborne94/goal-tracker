import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month") ?? new Date().toISOString().slice(0, 7);

  const budget = await prisma.monthlyBudget.findUnique({
    where: { userId_month: { userId: session.user.id, month } },
  });

  return NextResponse.json(budget);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const { month, amount } = await req.json();
  if (!month || !amount)
    return NextResponse.json({ error: "Mese e importo obbligatori" }, { status: 400 });

  const budget = await prisma.monthlyBudget.upsert({
    where: { userId_month: { userId: session.user.id, month } },
    create: { userId: session.user.id, month, amount: parseFloat(amount) },
    update: { amount: parseFloat(amount) },
  });

  return NextResponse.json(budget);
}
