import { prisma } from "@/lib/db";

const REWARDS = [
  { name: "Prima Stella", description: "Completa il tuo primo obiettivo", icon: "⭐", type: "milestone", condition: (c: number) => c >= 1 },
  { name: "In Marcia", description: "Completa 5 obiettivi", icon: "🚀", type: "milestone", condition: (c: number) => c >= 5 },
  { name: "Campione", description: "Completa 10 obiettivi", icon: "🏆", type: "milestone", condition: (c: number) => c >= 10 },
  { name: "Leggenda", description: "Completa 25 obiettivi", icon: "👑", type: "milestone", condition: (c: number) => c >= 25 },
  { name: "Puntatore", description: "Accumula 100 punti", icon: "💯", type: "badge", condition: (_: number, p: number) => p >= 100 },
  { name: "Esperto", description: "Accumula 500 punti", icon: "🎯", type: "badge", condition: (_: number, p: number) => p >= 500 },
];

export async function checkAndAwardRewards(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { userRewards: true } });
  if (!user) return;
  const completedCount = await prisma.goal.count({ where: { userId, status: "completed" } });
  const earnedIds = new Set(user.userRewards.map((ur) => ur.rewardId));

  for (const r of REWARDS) {
    if (!r.condition(completedCount, user.points)) continue;
    let reward = await prisma.reward.findUnique({ where: { name: r.name } });
    if (!reward) {
      reward = await prisma.reward.create({ data: { name: r.name, description: r.description, icon: r.icon, type: r.type } });
    }
    if (!earnedIds.has(reward.id)) {
      await prisma.userReward.create({ data: { userId, rewardId: reward.id } });
    }
  }
}
