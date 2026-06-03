import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { formatDate, calculateStreak } from "@/lib/utils";
import LogoutButton from "@/components/LogoutButton";
import DailyChallenges from "@/components/DailyChallenges";

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user!.id!;

  const currentMonth = new Date().toISOString().slice(0, 7);
  const [yr, mo] = currentMonth.split("-").map(Number);
  const monthStart = new Date(yr, mo - 1, 1);
  const monthEnd = new Date(yr, mo, 1);

  const weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0);
  const dow = weekStart.getDay();
  weekStart.setDate(weekStart.getDate() - (dow === 0 ? 6 : dow - 1));

  const [user, goals, financeBudget, financeAgg, streakMilestones, weekMilestones, weekGoals, todayFocusRaw] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      include: { userRewards: { include: { reward: true } } },
    }).catch(() =>
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, image: true, points: true, createdAt: true },
      }).then((u) => u ? { ...u, emailVerified: null, password: null, userRewards: [] } : null).catch(() => null)
    ),
    prisma.goal.findMany({
      where: { userId, status: { in: ["active", "completed"] } },
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
    prisma.milestone.findMany({
      where: { goal: { userId }, completed: true, completedAt: { not: null } },
      select: { completedAt: true },
    }),
    prisma.milestone.count({
      where: { goal: { userId }, completed: true, completedAt: { gte: weekStart } },
    }),
    prisma.goal.count({
      where: { userId, status: "completed", completedAt: { gte: weekStart } },
    }),
    prisma.goal.findMany({
      where: { userId, status: "active", reminderTime: { not: null } },
      select: {
        id: true,
        title: true,
        reminderTime: true,
        milestones: {
          where: { completed: false },
          orderBy: { order: "asc" },
          take: 1,
          select: { id: true, title: true },
        },
      },
      orderBy: { reminderTime: "asc" },
    }).catch(() => []),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const todayDayIdx = new Date().getDay();
  const dayStart = new Date(); dayStart.setHours(0,0,0,0);
  const dayEnd = new Date(dayStart.getTime() + 86400000);

  const [active, completed, topCatAgg, rawChallenges, challengeCompletions, milestoneCount, expenseCount, habits, weightCount, mealCount] = await Promise.all([
    prisma.goal.count({ where: { userId, status: "active" } }),
    prisma.goal.count({ where: { userId, status: "completed" } }),
    prisma.expense.groupBy({
      by: ["category"],
      where: { userId, date: { gte: monthStart, lt: monthEnd } },
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
      take: 1,
    }),
    prisma.$queryRawUnsafe<{ id: string; title: string; description: string; xp: number; type: string }[]>(
      `SELECT id, title, description, xp, type FROM "DailyChallenge" ORDER BY xp ASC`
    ).catch(() => [] as { id: string; title: string; description: string; xp: number; type: string }[]),
    prisma.$queryRawUnsafe<{ challengeId: string; completed: boolean }[]>(
      `SELECT "challengeId", "completed" FROM "UserDailyChallenge" WHERE "userId" = $1 AND "date" = $2`,
      userId, today
    ).catch(() => [] as { challengeId: string; completed: boolean }[]),
    prisma.milestone.count({ where: { goal: { userId }, completed: true, completedAt: { gte: dayStart, lt: dayEnd } } }).catch(() => 0),
    prisma.expense.count({ where: { userId, createdAt: { gte: dayStart, lt: dayEnd } } }).catch(() => 0),
    prisma.habit.findMany({ where: { userId }, include: { logs: { where: { date: today } } } }).catch(() => [] as { logs: unknown[] }[]),
    prisma.weightEntry.count({ where: { userId, createdAt: { gte: dayStart, lt: dayEnd } } }).catch(() => 0),
    prisma.mealLog.count({ where: { userId, date: today } }).catch(() => 0),
  ]);

  // Check-in quests scheduled for today
  const checkInGoalsRaw = await prisma.$queryRawUnsafe<{ id: string; title: string; checkInXP: number; checkInDays: string | null }[]>(
    `SELECT id, title, "checkInXP", "checkInDays" FROM "Goal" WHERE "userId" = $1 AND status = 'active' AND "dailyCheckIn" = true`,
    userId
  ).catch(() => [] as { id: string; title: string; checkInXP: number; checkInDays: string | null }[]);

  const checkInToday = checkInGoalsRaw.filter(
    (g) => !g.checkInDays || g.checkInDays.split(",").map(Number).includes(todayDayIdx)
  );

  let checkedInTodayIds = new Set<string>();
  if (checkInToday.length > 0) {
    const doneToday = await prisma.$queryRawUnsafe<{ goalId: string }[]>(
      `SELECT "goalId" FROM "QuestCheckIn" WHERE "userId" = $1 AND date = $2`,
      userId, today
    ).catch(() => [] as { goalId: string }[]);
    checkedInTodayIds = new Set(doneToday.map((d) => d.goalId));
  }

  const allHabitsDone = habits.length > 0 && habits.every((h: { logs: unknown[] }) => h.logs.length > 0);
  const conditionMap: Record<string, boolean> = {
    complete_milestone: milestoneCount >= 1,
    log_expense: expenseCount >= 1,
    check_habit: allHabitsDone,
    log_weight: weightCount >= 1,
    log_meal: mealCount >= 1,
  };
  const initialChallenges = rawChallenges.map(c => ({
    ...c,
    completed: challengeCompletions.find(co => co.challengeId === c.id)?.completed ?? false,
    conditionMet: conditionMap[c.type] ?? false,
  }));
  const todayFocus = todayFocusRaw.filter((g: { milestones: { id: string }[] }) => g.milestones.length > 0);
  const financeSpent = financeAgg._sum.amount ?? 0;
  const isOverBudget = financeBudget && financeSpent > financeBudget.amount;
  const streak = calculateStreak(streakMilestones.map((m) => m.completedAt));
  const topCat = topCatAgg[0] ?? null;
  const daysInMonth = new Date(yr, mo, 0).getDate();
  const daysLeft = Math.max(1, daysInMonth - new Date().getDate() + 1);
  const dailyBudgetLeft = financeBudget && financeSpent < financeBudget.amount
    ? (financeBudget.amount - financeSpent) / daysLeft
    : null;

  const CAT_ICONS: Record<string, string> = {
    groceries: "🛒", eating_out: "🍽️", transport: "🚗", housing: "🏠",
    utilities: "💡", health: "💊", subscriptions: "📱", hobby: "🎨",
    culture: "🎭", travel: "✈️", gifts: "🎁", unexpected: "⚡", other: "📦",
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-[#9d8ac7] text-sm">Welcome,</p>
          <h1 className="text-2xl font-bold text-[#ede9ff]">{user?.name || "Adventurer"} ⚔️</h1>
        </div>
        <LogoutButton />
      </div>

      {/* XP card */}
      <div className="rounded-2xl p-5 text-white mb-6 relative overflow-hidden" style={{background: "var(--theme-gradient)", border: "1px solid var(--theme-border)"}}>
        <div className="absolute top-0 right-0 w-32 h-32 opacity-10" style={{background: "radial-gradient(circle, var(--theme-accent) 0%, transparent 70%)"}}/>
        <p className="text-amber-300/80 text-sm mb-1">✨ Experience accumulated</p>
        <div className="flex items-end gap-2">
          <span className="text-4xl font-bold" style={{color: "var(--theme-accent)"}}>{user?.points ?? 0}</span>
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

      {/* Weekly recap */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="rounded-2xl border p-4 text-center" style={{background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)"}}>
          <div className="text-2xl mb-1">✅</div>
          <div className="text-2xl font-bold" style={{color: "var(--theme-accent)"}}>{weekMilestones}</div>
          <div className="text-xs" style={{color: "var(--theme-text-muted)"}}>This week</div>
        </div>
        <div className="rounded-2xl border p-4 text-center" style={{background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)"}}>
          <div className="text-2xl mb-1">👑</div>
          <div className="text-2xl font-bold" style={{color: "var(--theme-accent)"}}>{weekGoals}</div>
          <div className="text-xs" style={{color: "var(--theme-text-muted)"}}>Quests done</div>
        </div>
      </div>

      {/* Streak card */}
      <div className="rounded-2xl p-4 mb-6 flex items-center gap-4" style={{background: "var(--theme-surface)", border: "1px solid var(--theme-surface-border)"}}>
        <div className="text-4xl flex-shrink-0">{streak > 0 ? "🔥" : "💤"}</div>
        <div className="flex-1 min-w-0">
          {streak > 0 ? (
            <>
              <p className="text-lg font-bold text-amber-400">
                {streak}-day streak!
              </p>
              <p className="text-xs text-[#9d8ac7]">
                {streak >= 30
                  ? "Legendary dedication. Don't stop now!"
                  : streak >= 7
                  ? "One week strong — keep the fire burning!"
                  : streak >= 3
                  ? "Great momentum! Keep checking off milestones."
                  : "Nice start! Come back tomorrow to keep it going."}
              </p>
            </>
          ) : (
            <>
              <p className="text-base font-bold text-[#ede9ff]">No active streak</p>
              <p className="text-xs text-[#9d8ac7]">Complete a milestone today to start one!</p>
            </>
          )}
        </div>
        {streak > 0 && (
          <div className="flex-shrink-0 text-center">
            <div className="text-2xl font-bold text-amber-400">{streak}</div>
            <div className="text-xs text-[#6b5a9e]">days</div>
          </div>
        )}
      </div>

      {/* Today's check-ins */}
      {checkInToday.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-[#9d8ac7] mb-3 uppercase tracking-wider">📅 Today&apos;s check-ins</h2>
          <div className="space-y-2">
            {checkInToday.map((g) => {
              const done = checkedInTodayIds.has(g.id);
              return (
                <a
                  key={g.id}
                  href={`/goals/${g.id}`}
                  className="flex items-center gap-3 rounded-2xl border p-3 transition-colors"
                  style={{ background: done ? "var(--theme-surface)" : "var(--theme-surface)", borderColor: done ? "rgba(146,64,14,0.4)" : "var(--theme-surface-border)" }}
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold border-2 transition-colors ${
                      done ? "bg-amber-500 border-amber-500 text-black" : "border-[#3b2d6e] text-transparent"
                    }`}
                  >
                    ✓
                  </div>
                  <p className={`flex-1 text-sm font-medium truncate ${done ? "line-through" : "text-[#ede9ff]"}`} style={done ? { color: "var(--theme-text-muted)" } : {}}>
                    {g.title}
                  </p>
                  {!done && (
                    <span className="text-xs font-bold text-amber-400 flex-shrink-0">+{g.checkInXP} XP</span>
                  )}
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* Daily challenges */}
      <DailyChallenges initialChallenges={initialChallenges} />

      {/* Today's focus */}
      {todayFocus.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-[#9d8ac7] mb-3 uppercase tracking-wider">🎯 Today&apos;s focus</h2>
          <div className="space-y-2">
            {(todayFocus as { id: string; title: string; reminderTime: string | null; milestones: { id: string; title: string }[] }[]).map((g) => (
              <Link
                key={g.id}
                href={`/goals/${g.id}`}
                className="flex items-center gap-3 rounded-2xl border p-3 transition-colors"
                style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}
              >
                <div className="w-5 h-5 rounded-full border-2 border-[#3b2d6e] flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[#ede9ff] truncate">{g.milestones[0]?.title}</p>
                  <p className="text-xs truncate" style={{ color: "var(--theme-text-muted)" }}>{g.title}</p>
                </div>
                {g.reminderTime && (
                  <span className="text-xs text-amber-400/70 flex-shrink-0">🔔 {g.reminderTime}</span>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recent rewards */}
      {user?.userRewards && user.userRewards.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-[#9d8ac7] mb-3 uppercase tracking-wider">💎 Trophies earned</h2>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {user.userRewards.slice(0, 6).map((ur: { id: string; reward: { icon: string; name: string } }) => (
              <div
                key={ur.id}
                className="flex-shrink-0 rounded-xl border px-4 py-3 text-center"
                style={{background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)"}}
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
        className="block rounded-2xl p-4 mb-6 transition-colors border"
        style={isOverBudget
          ? { background: "rgba(127,29,29,0.2)", borderColor: "rgba(185,28,28,0.4)" }
          : { background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold uppercase tracking-wider" style={{color: "var(--theme-text-muted)"}}>💰 Finance</span>
          <span className="text-xs" style={{color: "var(--theme-accent)"}}>
            {new Date().toLocaleDateString("en-GB", { month: "long" })} →
          </span>
        </div>
        {financeBudget ? (
          <>
            <div className="flex justify-between text-sm mb-2">
              <span style={{color: "var(--theme-text-muted)"}}>Spent</span>
              <span className={`font-bold ${isOverBudget ? "text-red-400" : "text-[#ede9ff]"}`}>
                €{financeSpent.toFixed(2)} / €{financeBudget.amount.toFixed(2)}
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
            <div className="flex justify-between mt-2 text-xs">
              {isOverBudget ? (
                <span className="text-red-400">⚠️ Over by €{(financeSpent - financeBudget.amount).toFixed(2)}</span>
              ) : dailyBudgetLeft !== null ? (
                <span className="text-green-400">€{dailyBudgetLeft.toFixed(2)}/day · {daysLeft}d left</span>
              ) : <span />}
              {topCat && (
                <span style={{color: "var(--theme-text-muted)"}}>
                  Top: {CAT_ICONS[topCat.category] ?? "📦"} €{(topCat._sum.amount ?? 0).toFixed(0)}
                </span>
              )}
            </div>
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
        <div className="rounded-2xl border p-8 text-center" style={{background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)"}}>
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
                className="block rounded-2xl border p-4 transition-colors"
                style={{background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)"}}
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
