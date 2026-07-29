import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import ProfileClient from "@/components/ProfileClient";
import { calculateStreak } from "@/lib/utils";
import { getRecentStatEvents, getStatTotals } from "@/lib/hero-stats-server";

export default async function ProfilePage() {
  const session = await auth();
  const userId = session!.user!.id!;

  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

  const [userRaw, completed, active, streakMilestones, goalsForStats, recentMilestones] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRewards: {
          include: { reward: true },
          orderBy: { earnedAt: "desc" },
        },
      },
    }).catch(() =>
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, image: true, points: true, createdAt: true },
      }).then((u) => u ? { ...u, reminderEnabled: false, reminderTime: "09:00", theme: "warrior", onboardingComplete: true, password: null, emailVerified: null, userRewards: [] } : null).catch(() => null)
    ),
    prisma.goal.count({ where: { userId, status: "completed" } }),
    prisma.goal.count({ where: { userId, status: "active" } }),
    prisma.milestone.findMany({
      where: { goal: { userId }, completed: true, completedAt: { not: null } },
      select: { completedAt: true },
    }),
    prisma.goal.findMany({
      where: { userId },
      select: { status: true, category: { select: { name: true, color: true } } },
    }),
    prisma.milestone.findMany({
      where: { goal: { userId }, completed: true, completedAt: { gte: fourWeeksAgo } },
      select: { completedAt: true },
    }),
  ]);

  const user = userRaw;
  const streak = calculateStreak(streakMilestones.map((m) => m.completedAt));

  let heroClass: string | null = null;
  try {
    const hc = await prisma.$queryRawUnsafe<{ heroClass: string | null }[]>(
      `SELECT "heroClass" FROM "User" WHERE id = $1`, userId
    );
    heroClass = hc[0]?.heroClass ?? null;
  } catch { /* column not yet in DB */ }

  // Category breakdown
  const catMap = new Map<string, { name: string; color: string; total: number; completed: number }>();
  for (const g of goalsForStats) {
    if (!g.category) continue;
    const key = g.category.name;
    const existing = catMap.get(key) ?? { name: g.category.name, color: g.category.color, total: 0, completed: 0 };
    existing.total++;
    if (g.status === "completed") existing.completed++;
    catMap.set(key, existing);
  }
  const categoryStats = Array.from(catMap.values()).sort((a, b) => b.total - a.total);

  // Weekly milestones (last 4 weeks, oldest→newest)
  const now = new Date();
  const weekCounts = [0, 0, 0, 0];
  for (const m of recentMilestones) {
    if (!m.completedAt) continue;
    const daysAgo = Math.floor((now.getTime() - new Date(m.completedAt).getTime()) / 86400000);
    const weekIdx = Math.floor(daysAgo / 7);
    if (weekIdx < 4) weekCounts[weekIdx]++;
  }
  const weeklyMilestones = [...weekCounts].reverse();

  const stats = {
    total: completed + active,
    completed,
    active,
  };

  // La Scheda dell'Eroe: totali per stat e ultime righe del registro.
  const [statTotals, statEvents] = await Promise.all([
    getStatTotals(userId),
    getRecentStatEvents(userId, 12),
  ]);

  return (
    <ProfileClient
      user={JSON.parse(JSON.stringify(user))}
      stats={stats}
      streak={streak}
categoryStats={categoryStats}
      weeklyMilestones={weeklyMilestones}
      heroClass={heroClass}
      statTotals={statTotals}
      statEvents={JSON.parse(JSON.stringify(statEvents))}
    />
  );
}
