import { prisma } from "@/lib/db";

const REWARDS = [
  {
    name: "First Star",
    description: "Complete your first goal",
    icon: "⭐",
    type: "milestone",
    condition: (completedCount: number) => completedCount >= 1,
  },
  {
    name: "On the Move",
    description: "Complete 5 goals",
    icon: "🚀",
    type: "milestone",
    condition: (completedCount: number) => completedCount >= 5,
  },
  {
    name: "Champion",
    description: "Complete 10 goals",
    icon: "🏆",
    type: "milestone",
    condition: (completedCount: number) => completedCount >= 10,
  },
  {
    name: "Legend",
    description: "Complete 25 goals",
    icon: "👑",
    type: "milestone",
    condition: (completedCount: number) => completedCount >= 25,
  },
  {
    name: "Sharpshooter",
    description: "Accumulate 100 XP",
    icon: "💯",
    type: "badge",
    condition: (_: number, points: number) => points >= 100,
  },
  {
    name: "Expert",
    description: "Accumulate 500 XP",
    icon: "🎯",
    type: "badge",
    condition: (_: number, points: number) => points >= 500,
  },
];

const KAKEEBO_REWARDS = [
  {
    name: "First Budget",
    description: "Set your first monthly budget",
    icon: "💰",
    type: "badge",
  },
  {
    name: "Expense Hunter",
    description: "Log at least 10 expenses",
    icon: "🎯",
    type: "badge",
  },
  {
    name: "Saver",
    description: "Close a month within budget",
    icon: "💎",
    type: "badge",
  },
  {
    name: "Serial Saver",
    description: "Close 3 months within budget",
    icon: "🏦",
    type: "badge",
  },
];

const PESO_REWARDS = [
  {
    name: "First Weigh-in",
    description: "Log your first weight measurement",
    icon: "⚖️",
    type: "badge",
  },
  {
    name: "Consistent",
    description: "Log 10 weight measurements",
    icon: "📊",
    type: "badge",
  },
  {
    name: "Minus 5 kg",
    description: "Lose 5 kg from your starting weight",
    icon: "🔥",
    type: "milestone",
  },
  {
    name: "Minus 10 kg",
    description: "Lose 10 kg from your starting weight",
    icon: "💪",
    type: "milestone",
  },
];

const ROUTINE_REWARDS = [
  {
    name: "First Habit",
    description: "Create your first habit",
    icon: "🌱",
    type: "badge",
  },
  {
    name: "Streak 7",
    description: "7 consecutive days on a habit",
    icon: "🔥",
    type: "milestone",
  },
  {
    name: "Streak 30",
    description: "30 consecutive days on a habit",
    icon: "⚡",
    type: "milestone",
  },
  {
    name: "Perfect Day",
    description: "Complete all habits in a single day",
    icon: "✨",
    type: "badge",
  },
];

function calcStreak(dates: string[]): number {
  if (!dates.length) return 0;
  const set = new Set(dates);
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const start = set.has(today) ? today : set.has(yesterday) ? yesterday : null;
  if (!start) return 0;
  let streak = 0;
  const d = new Date(start);
  while (set.has(d.toISOString().slice(0, 10))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

async function upsertAndAward(
  userId: string,
  earnedNames: Set<string>,
  name: string,
  def: { name: string; description: string; icon: string; type: string }
) {
  if (earnedNames.has(name)) return;
  let reward = await prisma.reward.findUnique({ where: { name } });
  if (!reward) reward = await prisma.reward.create({ data: def });
  await prisma.userReward.create({ data: { userId, rewardId: reward.id } });
}

export async function checkAndAwardRewards(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { userRewards: true },
  });
  if (!user) return;

  const completedCount = await prisma.goal.count({
    where: { userId, status: "completed" },
  });
  const earnedIds = new Set(user.userRewards.map((ur: { rewardId: string }) => ur.rewardId));

  for (const r of REWARDS) {
    if (!r.condition(completedCount, user.points)) continue;

    let reward = await prisma.reward.findUnique({ where: { name: r.name } });
    if (!reward) {
      reward = await prisma.reward.create({
        data: { name: r.name, description: r.description, icon: r.icon, type: r.type },
      });
    }

    if (!earnedIds.has(reward.id)) {
      await prisma.userReward.create({ data: { userId, rewardId: reward.id } });
    }
  }
}

export async function checkAndAwardKakeeboRewards(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { userRewards: { include: { reward: true } } },
  });
  if (!user) return;

  const earnedNames = new Set(
    user.userRewards.map((ur: { reward: { name: string } }) => ur.reward.name)
  );

  const [budgetCount, expenseCount] = await Promise.all([
    prisma.monthlyBudget.count({ where: { userId } }),
    prisma.expense.count({ where: { userId } }),
  ]);

  const closedMonths = [...earnedNames].filter((n) =>
    n.startsWith("Month Saved:")
  ).length;

  const checks = [
    { condition: budgetCount >= 1, name: "First Budget" },
    { condition: expenseCount >= 10, name: "Expense Hunter" },
    { condition: closedMonths >= 1, name: "Saver" },
    { condition: closedMonths >= 3, name: "Serial Saver" },
  ];

  for (const { condition, name } of checks) {
    if (!condition) continue;
    const def = KAKEEBO_REWARDS.find((r) => r.name === name)!;
    await upsertAndAward(userId, earnedNames, name, def);
    earnedNames.add(name);
  }
}

export async function checkAndAwardPesoRewards(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { userRewards: { include: { reward: true } } },
  });
  if (!user) return;

  const earnedNames = new Set(
    user.userRewards.map((ur: { reward: { name: string } }) => ur.reward.name)
  );

  const entries = await prisma.weightEntry.findMany({
    where: { userId },
    orderBy: { date: "asc" },
  });

  const entryCount = entries.length;
  const firstWeight = entries[0]?.weight ?? null;
  const lastWeight = entries[entries.length - 1]?.weight ?? null;
  const weightLoss =
    firstWeight !== null && lastWeight !== null ? firstWeight - lastWeight : 0;

  const checks = [
    { condition: entryCount >= 1, name: "First Weigh-in" },
    { condition: entryCount >= 10, name: "Consistent" },
    { condition: weightLoss >= 5, name: "Minus 5 kg" },
    { condition: weightLoss >= 10, name: "Minus 10 kg" },
  ];

  for (const { condition, name } of checks) {
    if (!condition) continue;
    const def = PESO_REWARDS.find((r) => r.name === name)!;
    await upsertAndAward(userId, earnedNames, name, def);
    earnedNames.add(name);
  }
}

export async function checkAndAwardRoutineRewards(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { userRewards: { include: { reward: true } } },
  });
  if (!user) return;

  const earnedNames = new Set(
    user.userRewards.map((ur: { reward: { name: string } }) => ur.reward.name)
  );

  const habits = await prisma.habit.findMany({
    where: { userId },
    include: { logs: true },
  });

  const habitCount = habits.length;

  let maxStreak = 0;
  for (const habit of habits) {
    const s = calcStreak(habit.logs.map((l: { date: string }) => l.date));
    if (s > maxStreak) maxStreak = s;
  }

  const today = new Date().toISOString().slice(0, 10);
  const allDoneToday =
    habitCount > 0 &&
    habits.every((h) => h.logs.some((l: { date: string }) => l.date === today));

  const checks = [
    { condition: habitCount >= 1, name: "First Habit" },
    { condition: maxStreak >= 7, name: "Streak 7" },
    { condition: maxStreak >= 30, name: "Streak 30" },
    { condition: allDoneToday, name: "Perfect Day" },
  ];

  for (const { condition, name } of checks) {
    if (!condition) continue;
    const def = ROUTINE_REWARDS.find((r) => r.name === name)!;
    await upsertAndAward(userId, earnedNames, name, def);
    earnedNames.add(name);
  }
}
