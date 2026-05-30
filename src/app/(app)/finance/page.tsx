import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import FinanceClient from "@/components/finance/FinanceClient";

export default async function FinancePage() {
  const session = await auth();
  const userId = session!.user!.id!;

  const currentMonth = new Date().toISOString().slice(0, 7);
  const [year, m] = currentMonth.split("-").map(Number);
  const start = new Date(year, m - 1, 1);
  const end = new Date(year, m, 1);

  const [budget, expenses] = await Promise.all([
    prisma.monthlyBudget.findUnique({
      where: { userId_month: { userId, month: currentMonth } },
    }),
    prisma.expense.findMany({
      where: { userId, date: { gte: start, lt: end } },
      orderBy: { date: "desc" },
    }),
  ]);

  // Check if the current month has been closed (reward already claimed)
  let budgetClosed = false;
  if (budget) {
    const rewardName = `Month Saved: ${currentMonth}`;
    const closedReward = await prisma.reward.findUnique({ where: { name: rewardName } });
    if (closedReward) {
      const hasIt = await prisma.userReward.findFirst({
        where: { userId, rewardId: closedReward.id },
      });
      budgetClosed = !!hasIt;
    }
  }

  // Last 6 months trend (always relative to now)
  const trend = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(year, m - 1 - i, 1);
    const s = new Date(d.getFullYear(), d.getMonth(), 1);
    const e = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const mo = s.toISOString().slice(0, 7);
    const [agg, bud] = await Promise.all([
      prisma.expense.aggregate({
        where: { userId, date: { gte: s, lt: e } },
        _sum: { amount: true },
      }),
      prisma.monthlyBudget.findUnique({
        where: { userId_month: { userId, month: mo } },
      }),
    ]);
    trend.push({
      month: mo,
      label: s.toLocaleDateString("en-GB", { month: "short" }),
      spent: agg._sum.amount ?? 0,
      budget: bud?.amount ?? null,
    });
  }

  return (
    <FinanceClient
      initialMonth={currentMonth}
      initialBudget={budget ? { id: budget.id, month: budget.month, amount: budget.amount, closed: budgetClosed } : null}
      initialExpenses={JSON.parse(JSON.stringify(expenses))}
      trend={trend}
    />
  );
}
