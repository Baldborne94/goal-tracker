import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { formatDate, calculateStreak } from "@/lib/utils";
import { getLevelProgress } from "@/lib/levels";
import { getClassDef } from "@/lib/classes";
import LogoutButton from "@/components/LogoutButton";
import TodayPanel from "@/components/TodayPanel";
import WeeklyLifeSummary from "@/components/WeeklyLifeSummary";
import { formatDuration, formatMetricValue } from "@/lib/health";

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user!.id!;

  // Fetch user flags + redirect checks
  let heroClass: string | null = null;
  let onboardingComplete = true;
  try {
    const flags = await prisma.$queryRawUnsafe<{ heroClass: string | null; onboardingComplete: boolean | null }[]>(
      `SELECT "heroClass", "onboardingComplete" FROM "User" WHERE id = $1`, userId
    );
    heroClass = flags[0]?.heroClass ?? null;
    onboardingComplete = flags[0]?.onboardingComplete ?? false;
  } catch { heroClass = "fighter"; onboardingComplete = true; }

  if (!heroClass) redirect("/class-select");

  const [earlyActive, earlyCompleted] = await Promise.all([
    prisma.goal.count({ where: { userId, status: "active" } }),
    prisma.goal.count({ where: { userId, status: "completed" } }),
  ]);
  if (earlyActive === 0 && earlyCompleted === 0 && !onboardingComplete) redirect("/tutorial");

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

  const active = earlyActive;
  const completed = earlyCompleted;

  // Rotation: challenges change every 14 days (4 groups)
  const currentChallengeGroup = Math.floor(Math.floor(new Date().getTime() / 86400000) / 7) % 4;

  const [topCatAgg, rawChallenges, challengeCompletions, milestoneCount, expenseCount, questCheckinTodayRaw, completedQuestCount] = await Promise.all([
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
    prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*) as count FROM "QuestCheckIn" WHERE "userId" = $1 AND date = $2`,
      userId, today
    ).catch(() => [{ count: BigInt(0) }]),
    prisma.goal.count({ where: { userId, status: "completed", completedAt: { gte: dayStart, lt: dayEnd } } }).catch(() => 0),
  ]);

  // I numeri del braccialetto per la testata del Reame: passi di oggi e
  // sonno di stanotte. HealthMetric.date è nel fuso del telefono, coerente
  // con il resto delle query "di oggi".
  const [stepsTodayRaw, sleepTodayRaw] = await Promise.all([
    prisma.$queryRawUnsafe<{ total: number | null }[]>(
      `SELECT SUM(value) as total FROM "HealthMetric" WHERE "userId" = $1 AND "metricType" = 'steps' AND date = $2`,
      userId, today
    ).catch(() => [{ total: null }]),
    prisma.$queryRawUnsafe<{ total: number | null }[]>(
      `SELECT SUM(value) as total FROM "HealthMetric" WHERE "userId" = $1 AND "metricType" = 'sleep' AND date = $2`,
      userId, today
    ).catch(() => [{ total: null }]),
  ]);
  const stepsToday = stepsTodayRaw[0]?.total != null ? Number(stepsTodayRaw[0].total) : null;
  const sleepToday = sleepTodayRaw[0]?.total != null ? Number(sleepTodayRaw[0].total) : null;

  const [gymLogCount, mealLogCount, shoppingCheckedCount] = await Promise.all([
    prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*) as count FROM "GymLog" WHERE "userId" = $1 AND date = $2`,
      userId, today
    ).catch(() => [{ count: BigInt(0) }]),
    prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*) as count FROM "FoodEntry" WHERE "userId" = $1 AND date = $2`,
      userId, today
    ).catch(() => [{ count: BigInt(0) }]),
    prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*) as count FROM "ShoppingItem" WHERE "userId" = $1 AND "checked" = true`,
      userId
    ).catch(() => [{ count: BigInt(0) }]),
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

  const CHALLENGE_GROUP_IDS: Record<number, string[]> = {
    0: ["ch_g0_milestone", "ch_g0_gym", "ch_g0_meals", "ch_g0_expense"],
    1: ["ch_g1_miles3",    "ch_g1_gym", "ch_g1_meals", "ch_g1_shopping"],
    2: ["ch_g2_milestone", "ch_g2_gym", "ch_g2_meals", "ch_g2_quest"],
    3: ["ch_g3_checkin",   "ch_g3_gym", "ch_g3_meals", "ch_g3_weight"],
  };
  const groupIdSet = new Set(CHALLENGE_GROUP_IDS[currentChallengeGroup] ?? []);
  const groupChallenges = rawChallenges.filter(c => groupIdSet.has(c.id));
  const visibleChallenges = groupChallenges.length > 0 ? groupChallenges : rawChallenges.slice(0, 4);

  const conditionMap: Record<string, boolean> = {
    complete_milestone:    milestoneCount >= 1,
    complete_3_milestones: milestoneCount >= 3,
    complete_quest:        completedQuestCount >= 1,
    log_expense:           expenseCount >= 1,
    daily_checkin:         Number(questCheckinTodayRaw[0]?.count ?? 0) >= 1,
    log_gym:               Number(gymLogCount[0]?.count ?? 0) >= 1,
    complete_meals:        Number(mealLogCount[0]?.count ?? 0) >= 1,
    check_shopping:        Number(shoppingCheckedCount[0]?.count ?? 0) >= 3,
  };
  const initialChallenges = visibleChallenges.map(c => ({
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

  const levelInfo = getLevelProgress(user?.points ?? 0, heroClass);
  const classDef = getClassDef(heroClass);

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
          <p className="text-[#9d8ac7] text-sm">Benvenuto,</p>
          <h1 className="text-2xl font-bold text-[#ede9ff]">{user?.name || "Avventuriero"} {levelInfo.current.icon}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/tutorial"
            className="w-8 h-8 rounded-full border flex items-center justify-center text-sm font-bold transition-colors hover:border-amber-500/40"
            style={{ borderColor: "var(--theme-surface-border)", color: "var(--theme-text-muted)", background: "var(--theme-surface)" }}
            title="Come si gioca"
          >
            ?
          </Link>
          <LogoutButton />
        </div>
      </div>

      <>

      {/* XP card */}
      <div className="rounded-2xl p-5 text-white mb-6 relative overflow-hidden" style={{background: "var(--theme-gradient)", border: "1px solid var(--theme-border)"}}>
        <div className="absolute top-0 right-0 w-32 h-32 opacity-10" style={{background: "radial-gradient(circle, var(--theme-accent) 0%, transparent 70%)"}}/>
        <div className="flex items-start justify-between mb-1">
          <p className="text-amber-300/80 text-sm">✨ Esperienza</p>
          <span className="text-sm font-bold" style={{color: "var(--theme-accent)"}}>
            {levelInfo.current.icon} {levelInfo.current.label}
          </span>
        </div>
        <div className="flex items-end gap-2 mb-3">
          <span className="text-4xl font-bold" style={{color: "var(--theme-accent)"}}>{user?.points ?? 0}</span>
          <span className="text-amber-300/60 mb-1">XP</span>
        </div>
        {/* Level progress bar */}
        {levelInfo.next ? (
          <>
            <div className="h-2.5 rounded-full overflow-hidden mb-1.5" style={{background: "rgba(0,0,0,0.35)"}}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{width: `${levelInfo.progress}%`, background: "var(--theme-accent)"}}
              />
            </div>
            <div className="flex justify-between text-xs" style={{color: "rgba(251,191,36,0.55)"}}>
              <span>{levelInfo.progress}%</span>
              <span>{levelInfo.next.icon} {levelInfo.next.label} — {levelInfo.xpNeeded} XP al prossimo</span>
            </div>
          </>
        ) : (
          <p className="text-xs font-semibold text-amber-400">👑 Livello massimo — Leggendario!</p>
        )}
        <div className="mt-3 flex gap-4 text-sm border-t border-white/10 pt-3">
          <div>
            <span className="text-[#9d8ac7]">⚡ Attive: </span>
            <span className="font-semibold text-[#ede9ff]">{active}</span>
          </div>
          <div>
            <span className="text-[#9d8ac7]">👑 Completate: </span>
            <span className="font-semibold text-[#ede9ff]">{completed}</span>
          </div>
        </div>
      </div>

      {/* Weekly recap */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="rounded-2xl border p-4 text-center" style={{background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)"}}>
          <div className="text-2xl mb-1">✅</div>
          <div className="text-2xl font-bold" style={{color: "var(--theme-accent)"}}>{weekMilestones}</div>
          <div className="text-xs" style={{color: "var(--theme-text-muted)"}}>Questa settimana</div>
        </div>
        <div className="rounded-2xl border p-4 text-center" style={{background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)"}}>
          <div className="text-2xl mb-1">👑</div>
          <div className="text-2xl font-bold" style={{color: "var(--theme-accent)"}}>{weekGoals}</div>
          <div className="text-xs" style={{color: "var(--theme-text-muted)"}}>Missioni completate</div>
        </div>
      </div>

      {/* Streak card */}
      <div className="rounded-2xl p-4 mb-6 flex items-center gap-4" style={{background: "var(--theme-surface)", border: "1px solid var(--theme-surface-border)"}}>
        <div className="text-4xl flex-shrink-0">{streak > 0 ? "🔥" : "💤"}</div>
        <div className="flex-1 min-w-0">
          {streak > 0 ? (
            <>
              <p className="text-lg font-bold text-amber-400">
                Serie di {streak} giorni!
              </p>
              <p className="text-xs text-[#9d8ac7]">
                {streak >= 30
                  ? "Dedizione leggendaria. Non fermarti ora!"
                  : streak >= 7
                  ? "Una settimana forte — mantieni il fuoco acceso!"
                  : streak >= 3
                  ? "Ottimo slancio! Continua a completare le milestone."
                  : "Buon inizio! Torna domani per mantenerlo."}
              </p>
            </>
          ) : (
            <>
              <p className="text-base font-bold text-[#ede9ff]">Nessuna serie attiva</p>
              <p className="text-xs text-[#9d8ac7]">Completa una milestone oggi per iniziarne una!</p>
            </>
          )}
        </div>
        {streak > 0 && (
          <div className="flex-shrink-0 text-center">
            <div className="text-2xl font-bold text-amber-400">{streak}</div>
            <div className="text-xs text-[#6b5a9e]">giorni</div>
          </div>
        )}
      </div>

      {/* Il braccialetto nel Reame: passi di oggi e sonno di stanotte */}
      {(stepsToday != null || sleepToday != null) && (
        <div className="grid grid-cols-2 gap-3 mb-6">
          <Link
            href="/salute"
            className="rounded-2xl border p-3 flex items-center gap-3 active:scale-95 transition-transform"
            style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}
          >
            <span className="text-2xl">👟</span>
            <div className="min-w-0">
              <p className="text-lg font-bold text-[#ede9ff] tabular-nums leading-tight">
                {stepsToday != null ? formatMetricValue("steps", stepsToday) : "—"}
              </p>
              <p className="text-[10px]" style={{ color: "var(--theme-text-muted)" }}>passi oggi</p>
            </div>
          </Link>
          <Link
            href="/salute"
            className="rounded-2xl border p-3 flex items-center gap-3 active:scale-95 transition-transform"
            style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}
          >
            <span className="text-2xl">😴</span>
            <div className="min-w-0">
              <p className="text-lg font-bold text-[#ede9ff] tabular-nums leading-tight">
                {sleepToday != null ? formatDuration(sleepToday) : "—"}
              </p>
              <p className="text-[10px]" style={{ color: "var(--theme-text-muted)" }}>sonno stanotte</p>
            </div>
          </Link>
        </div>
      )}

      {/* Weekly life summary */}
      <WeeklyLifeSummary userId={userId} />

      {/* Oggi: check-in delle missioni + sfide, un'unica lista */}
      <TodayPanel
        checkIns={checkInToday.map((g) => ({
          id: g.id,
          title: g.title,
          xp: g.checkInXP,
          done: checkedInTodayIds.has(g.id),
        }))}
        initialChallenges={initialChallenges}
      />

      {/* Today's focus */}
      {todayFocus.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-[#9d8ac7] mb-3 uppercase tracking-wider">🎯 Focus di oggi</h2>
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
          <h2 className="text-sm font-semibold text-[#9d8ac7] mb-3 uppercase tracking-wider">💎 Trofei ottenuti</h2>
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
          <span className="text-sm font-semibold uppercase tracking-wider" style={{color: "var(--theme-text-muted)"}}>💰 Finanze</span>
          <span className="text-xs" style={{color: "var(--theme-accent)"}}>
            {new Date().toLocaleDateString("it-IT", { month: "long" })} →
          </span>
        </div>
        {financeBudget ? (
          <>
            <div className="flex justify-between text-sm mb-2">
              <span style={{color: "var(--theme-text-muted)"}}>Speso</span>
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
                <span className="text-red-400">⚠️ Sforato di €{(financeSpent - financeBudget.amount).toFixed(2)}</span>
              ) : dailyBudgetLeft !== null ? (
                <span className="text-green-400">€{dailyBudgetLeft.toFixed(2)}/giorno · {daysLeft}gg rimasti</span>
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
            €{financeSpent.toFixed(2)} spesi · <span className="text-amber-400/70">Imposta un budget →</span>
          </p>
        )}
      </Link>

      {/* Recent goals */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-[#9d8ac7] uppercase tracking-wider">⚔️ Missioni recenti</h2>
        <Link href="/goals" className="text-sm text-amber-400 font-medium hover:text-amber-300">
          Vedi tutte →
        </Link>
      </div>

      {goals.length === 0 ? (
        <div className="rounded-2xl border p-8 text-center" style={{background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)"}}>
          <div className="text-4xl mb-3">{classDef.icon}</div>
          <p className="text-[#9d8ac7] text-sm mb-4">Nessuna missione ancora</p>
          <Link
            href="/goals/new"
            className="inline-block px-5 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-400 text-black rounded-xl text-sm font-bold"
          >
            Inizia la tua prima missione
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {goals.map((goal: { id: string; title: string; status: string; progress: number; targetDate: Date | null; category: { name: string; color: string } | null; milestones: { completed: boolean }[] }) => {
            const milestonesDone = goal.milestones.filter((m) => m.completed).length;
            const milestonesTotal = goal.milestones.length;
            const goalOverdue = goal.status === "active" && !!goal.targetDate && new Date(goal.targetDate) < new Date(today);

            return (
              <Link
                key={goal.id}
                href={`/goals/${goal.id}`}
                className="block rounded-2xl border p-4 transition-colors"
                style={{background: "var(--theme-surface)", borderColor: goalOverdue ? "rgba(239,68,68,0.35)" : "var(--theme-surface-border)"}}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-[#ede9ff] line-clamp-1">{goal.title}</h3>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-medium border ${
                      goal.status === "completed"
                        ? "bg-amber-900/30 text-amber-300 border-amber-700/40"
                        : goalOverdue
                        ? "bg-red-900/30 text-red-400 border-red-800/40"
                        : "bg-violet-900/30 text-violet-300 border-violet-700/40"
                    }`}
                  >
                    {goal.status === "completed" ? "👑 Fatta" : goalOverdue ? "⚠️ Scaduta" : "⚡ Attiva"}
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
                        ? `${milestonesDone}/${milestonesTotal} milestone`
                        : "Progresso"}
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
                    🌙 Scadenza: {formatDate(goal.targetDate)}
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
      </>
    </div>
  );
}
