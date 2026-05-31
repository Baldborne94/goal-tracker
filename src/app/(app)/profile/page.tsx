import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import ProfileClient from "@/components/ProfileClient";
import { calculateStreak } from "@/lib/utils";

export default async function ProfilePage() {
  const session = await auth();
  const userId = session!.user!.id!;

  const [user, completed, active, streakMilestones] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRewards: {
          include: { reward: true },
          orderBy: { earnedAt: "desc" },
        },
      },
    }),
    prisma.goal.count({ where: { userId, status: "completed" } }),
    prisma.goal.count({ where: { userId, status: "active" } }),
    prisma.milestone.findMany({
      where: { goal: { userId }, completed: true, completedAt: { not: null } },
      select: { completedAt: true },
    }),
  ]);

  const streak = calculateStreak(streakMilestones.map((m) => m.completedAt));

  const stats = {
    total: completed + active,
    completed,
    active,
  };

  return (
    <ProfileClient
      user={JSON.parse(JSON.stringify(user))}
      stats={stats}
      streak={streak}
    />
  );
}
