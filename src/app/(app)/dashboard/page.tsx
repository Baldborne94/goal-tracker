import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user!.id!;

  const currentMonth = new Date().toISOString().slice(0, 7);
  const [yr, mo] = currentMonth.split("-").map(Number);
  const monthStart = new Date(yr, mo - 1, 1);
  const monthEnd = new Date(yr, mo, 1);

  const [user, goals, financeBudget, financeAgg] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      include: { userRewards: { include: { reward: true } } },
    }),
    prisma.goal.findMany({
      where: { userId },
      include: { category: true, milestones: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.monthlyBudget.findUnique({
      where: { userId_month: { userId, month: currentMonth } },
    }),
    prisma.expense.aggregate({
      where: { userId, date: { gte: monthStart, lt: monthEnd } },
      _sum: { amount: true },
    }),
  ]);

  const total = await prisma.goal.count({ where: { userId } });
  const completed = await prisma.goal.count({ where: { userId, status: "completed" } });
  const active = total - completed;
  const financeSpent = financeAgg._sum.amount ?? 0;
  const isOverBudget = financeBudget && financeSpent > financeBudget.amount;

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <p className="text-[#9d8ac7] text-sm">Welcome,</p>
        <h1 className="text-2xl font-bold text-[#ede9ff]">{user?.name || "Adventurer"} ⚔️</h1>
      </div>

      {/* XP card */}
      <div className="rounded-2xl p-5 text-white mb-6 relative overflow-hidden" style={{background: "linear-gradient(135deg, #2d1b6e 0%, #1a0f3e 50%, #0f0826 100%)", border: "1px solid #4c3880"}}>
        <div className="absolute top-0 right-0 w-32 h-32 opacity-10" style={{background: "radial-gradient(circle, #f59e0b 0%, transparent 70%)"}}/>
        <p className="text-amber-300/80 text-sm mb-1">✨ Magic accumulated</p>
        <div className="flex items-end gap-2">
          <span className="text-4xl font-bold text-amber-400">{user?.points ?? 0}</span>
          <span className="text-amber-300/60 mb-1">XP</span>
        </div>
        <div className="mt-3 flex gap-4 text-sm">
          <div>
            <span className="text-[#9d8ac7]">⚡ Active: </span>
            <span className="font-semibold text-[#ede9ff]">{active}</span>
          </div>
          <div>
            <span className="text-[#9d8ac7]">👑 Completed: </span>
            <span className="font-semibold text-[#ede9ff]">{completed}</span>
          </div>
        </div>
      </div>

      {/* Recent rewards */}
      {user?.userRewards && user.userRewards.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-[#9d8ac7] mb-3 uppercase tracking-wider">💎 Trophies earned</h2>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {user.userRewards.slice(0, 6).map((ur: { id: string; reward: { icon: string; name: string } }) => (
              <div
                key={ur.id}
                className="flex-shrink-0 bg-[#16112e] rounded-xl border border-[#3b2d6e] px-4 py-3 text-center"
              >
                <div className="text-2xl mb-1">{ur.reward.icon}</div>
                <div className="text-xs font-medium text-[#c4b5fd] whitespace-nowrap">
                  {ur.reward.name}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Finance widget */}
      <Link
        href="/finance"
        className={`block rounded-2xl p-4 mb-6 transition-colors hover:border-amber-500/40 border ${
          isOverBudget
            ? "bg-red-950/30 border-red-700/40"
            : "bg-[#16112e] border-[#3b2d6e]"
        }`}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-[#9d8ac7] uppercase tracking-wider">💰 Finance</span>
          <span className="text-xs text-amber-400">
            {new Date().toLocaleDateString("en-GB", { month: "long" })} →
          </span>
        </div>
        {financeBudget ? (
          <>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-[#9d8ac7]">Spent</span>
              <span className={`font-bold ${isOverBudget ? "text-red-400" : "text-[#ede9ff]"}`}>
                €{financeSpent.toFixed(0)} / €{financeBudget.amount.toFixed(0)}
              </span>
            </div>
            <div className="h-2 bg-[#0f0d22] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  isOverBudget ? "bg-red-500" : financeSpent / financeBudget.amount > 0.8 ? "bg-amber-500" : "bg-violet-500"
                }`}
                style={{ width: `${Math.min(100, (financeSpent / financeBudget.amount) * 100)}%` }}
              />
            </div>
            {isOverBudget && (
              <p className="text-xs text-red-400 mt-1.5">
                ⚠️ Over budget by €{(financeSpent - financeBudget.amount).toFixed(2)}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-[#9d8ac7]">
            €{financeSpent.toFixed(2)} spent · <span className="text-amber-400/70">Set a budget →</span>
          </p>
        )}
      </Link>

      {/* Recent goals */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-[#9d8ac7] uppercase tracking-wider">⚔️ Recent quests</h2>
        <Link href="/goals" className="text-sm text-amber-400 font-medium hover:text-amber-300">
          See all →
        </Link>
      </div>

      {goals.length === 0 ? (
        <div className="bg-[#16112e] rounded-2xl border border-[#3b2d6e] p-8 text-center">
          <div className="text-4xl mb-3">🗡️</div>
          <p className="text-[#9d8ac7] text-sm mb-4">No quests yet</p>
          <Link
            href="/goals/new"
            className="inline-block px-5 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-400 text-black rounded-xl text-sm font-bold"
          >
            Start your first quest
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {goals.map((goal: { id: string; title: string; status: string; progress: number; targetDate: Date | null; category: { name: string; color: string } | null; milestones: { completed: boolean }[] }) => {
            const milestonesDone = goal.milestones.filter((m) => m.completed).length;
            const milestonesTotal = goal.milestones.length;

            return (
              <Link
                key={goal.id}
                href={`/goals/${goal.id}`}
                className="block bg-[#16112e] rounded-2xl border border-[#3b2d6e] p-4 hover:border-amber-500/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-[#ede9ff] line-clamp-1">{goal.title}</h3>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-medium border ${
                      goal.status === "completed"
                        ? "bg-amber-900/30 text-amber-300 border-amber-700/40"
                        : "bg-violet-900/30 text-violet-300 border-violet-700/40"
                    }`}
                  >
                    {goal.status === "completed" ? "👑 Done" : "⚡ Active"}
                  </span>
                </div>

                {goal.category && (
                  <div
                    className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full mb-2"
                    style={{ backgroundColor: goal.category.color + "25", color: goal.category.color }}
                  >
                    {goal.category.name}
                  </div>
                )}

                <div className="mt-2">
                  <div className="flex items-center justify-between text-xs text-[#6b5a9e] mb-1">
                    <span>
                      {milestonesTotal > 0
                        ? `${milestonesDone}/${milestonesTotal} milestones`
                        : "Progress"}
                    </span>
                    <span className="text-amber-400/80">{goal.progress}%</span>
                  </div>
                  <div className="h-1.5 bg-[#0f0d22] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        goal.progress >= 100
                          ? "bg-amber-400"
                          : goal.progress >= 50
                          ? "bg-violet-500"
                          : "bg-violet-700"
                      }`}
                      style={{ width: `${goal.progress}%` }}
                    />
                  </div>
                </div>

                {goal.targetDate && (
                  <p className="text-xs text-[#6b5a9e] mt-2">
                    🌙 Deadline: {formatDate(goal.targetDate)}
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      )}

      {/* FAB */}
      <Link
        href="/goals/new"
        className="fixed bottom-20 right-4 w-14 h-14 bg-gradient-to-br from-amber-500 to-yellow-400 text-black rounded-full shadow-lg shadow-amber-900/40 flex items-center justify-center text-2xl hover:from-amber-400 hover:to-yellow-300 active:scale-95 transition-all z-40 font-bold"
      >
        +
      </Link>
    </div>
  );
}
