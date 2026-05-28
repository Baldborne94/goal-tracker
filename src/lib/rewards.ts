import { prisma } from "@/lib/db";

const REWARDS = [
  {
    name: "Prima Stella",
    description: "Completa il tuo primo obiettivo",
    icon: "⭐",
    type: "milestone",
    condition: (completedCount: number) => completedCount >= 1,
  },
  {
    name: "In Marcia",
    description: "Completa 5 obiettivi",
    icon: "🚀",
    type: "milestone",
    condition: (completedCount: number) => completedCount >= 5,
  },
  {
    name: "Campione",
    description: "Completa 10 obiettivi",
    icon: "🏆",
    type: "milestone",
    condition: (completedCount: number) => completedCount >= 10,
  },
  {
    name: "Leggenda",
    description: "Completa 25 obiettivi",
    icon: "👑",
    type: "milestone",
    condition: (completedCount: number) => completedCount >= 25,
  },
  {
    name: "Puntatore",
    description: "Accumula 100 punti",
    icon: "💯",
    type: "badge",
    condition: (_: number, points: number) => points >= 100,
  },
  {
    name: "Esperto",
    description: "Accumula 500 punti",
    icon: "🎯",
    type: "badge",
    condition: (_: number, points: number) => points >= 500,
  },
];

const KAKEEBO_REWARDS = [
  {
    name: "Primo Bilancio",
    description: "Imposta il tuo primo budget mensile",
    icon: "💰",
    type: "badge",
  },
  {
    name: "Cacciatore di Spese",
    description: "Registra almeno 10 spese",
    icon: "🎯",
    type: "badge",
  },
  {
    name: "Risparmiatore",
    description: "Chiudi un mese entro il budget",
    icon: "💎",
    type: "badge",
  },
  {
    name: "Risparmiatore Seriale",
    description: "Chiudi 3 mesi entro il budget",
    icon: "🏦",
    type: "badge",
  },
];

const PESO_REWARDS = [
  {
    name: "Prima Pesata",
    description: "Registra la tua prima misurazione del peso",
    icon: "⚖️",
    type: "badge",
  },
  {
    name: "Costante",
    description: "Registra 10 misurazioni del peso",
    icon: "📊",
    type: "badge",
  },
  {
    name: "Meno 5 kg",
    description: "Perdi 5 kg dal tuo peso iniziale",
    icon: "🔥",
    type: "milestone",
  },
  {
    name: "Meno 10 kg",
    description: "Perdi 10 kg dal tuo peso iniziale",
    icon: "💪",
    type: "milestone",
  },
];

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
        data: {
          name: r.name,
          description: r.description,
          icon: r.icon,
          type: r.type,
        },
      });
    }

    if (!earnedIds.has(reward.id)) {
      await prisma.userReward.create({
        data: { userId, rewardId: reward.id },
      });
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
    n.startsWith("Mese Risparmiato:")
  ).length;

  const checks = [
    { condition: budgetCount >= 1, name: "Primo Bilancio" },
    { condition: expenseCount >= 10, name: "Cacciatore di Spese" },
    { condition: closedMonths >= 1, name: "Risparmiatore" },
    { condition: closedMonths >= 3, name: "Risparmiatore Seriale" },
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
    { condition: entryCount >= 1, name: "Prima Pesata" },
    { condition: entryCount >= 10, name: "Costante" },
    { condition: weightLoss >= 5, name: "Meno 5 kg" },
    { condition: weightLoss >= 10, name: "Meno 10 kg" },
  ];

  for (const { condition, name } of checks) {
    if (!condition) continue;
    const def = PESO_REWARDS.find((r) => r.name === name)!;
    await upsertAndAward(userId, earnedNames, name, def);
    earnedNames.add(name);
  }
}
