import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkAndAwardKakeeboRewards } from "@/lib/rewards";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const { month } = await req.json();
  const userId = session.user.id;

  // Already closed?
  const rewardName = `Mese Risparmiato: ${month}`;
  const existing = await prisma.reward.findUnique({ where: { name: rewardName } });
  if (existing) {
    const alreadyHas = await prisma.userReward.findFirst({
      where: { userId, rewardId: existing.id },
    });
    if (alreadyHas) return NextResponse.json({ alreadyClosed: true });
  }

  const budget = await prisma.monthlyBudget.findUnique({
    where: { userId_month: { userId, month } },
  });
  if (!budget)
    return NextResponse.json({ error: "Nessun budget impostato" }, { status: 400 });

  const [year, m] = month.split("-").map(Number);
  const expenses = await prisma.expense.findMany({
    where: {
      userId,
      date: { gte: new Date(year, m - 1, 1), lt: new Date(year, m, 1) },
    },
  });
  const totalSpent = expenses.reduce((s, e) => s + e.amount, 0);

  if (totalSpent > budget.amount)
    return NextResponse.json({ success: false, overBudget: true });

  // Create the per-month badge
  let reward = await prisma.reward.findUnique({ where: { name: rewardName } });
  if (!reward) {
    reward = await prisma.reward.create({
      data: {
        name: rewardName,
        description: `Budget rispettato — ${month}`,
        icon: "💎",
        type: "badge",
      },
    });
  }

  const XP = 25;
  await prisma.user.update({
    where: { id: userId },
    data: { points: { increment: XP } },
  });
  await prisma.userReward.create({ data: { userId, rewardId: reward.id } });

  // Check for milestone badges (Risparmiatore, Risparmiatore Seriale)
  await checkAndAwardKakeeboRewards(userId);

  return NextResponse.json({ success: true, xpEarned: XP });
}
