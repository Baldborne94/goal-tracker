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
  const userId = session.user.id;

  const budget = await prisma.monthlyBudget.findUnique({
    where: { userId_month: { userId, month } },
  });

  if (!budget) return NextResponse.json(null);

  const rewardName = `Month Saved: ${month}`;
  const closedReward = await prisma.reward.findUnique({ where: { name: rewardName } });
  let closed = false;
  if (closedReward) {
    const hasIt = await prisma.userReward.findFirst({
      where: { userId, rewardId: closedReward.id },
    });
    closed = !!hasIt;
  }

  return NextResponse.json({ ...budget, closed });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { month, amount } = await req.json();
  if (!month || !amount)
    return NextResponse.json({ error: "Month and amount are required" }, { status: 400 });

  const userId = session.user.id;

  const budget = await prisma.monthlyBudget.upsert({
    where: { userId_month: { userId, month } },
    create: { userId, month, amount: parseFloat(amount) },
    update: { amount: parseFloat(amount) },
  });

  await checkAndAwardKakeeboRewards(userId);

  return NextResponse.json(budget);
}
