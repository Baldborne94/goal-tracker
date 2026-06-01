import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import ProfileClient from "@/components/ProfileClient";
import { calculateStreak } from "@/lib/utils";

export default async function ProfilePage() {
  const session = await auth();
  const userId = session!.user!.id!;

  const [userRaw, completed, active, streakMilestones] = await Promise.all([
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
  ]);

  const user = userRaw;
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
      dbReminderEnabled={user?.reminderEnabled ?? false}
      dbReminderTime={user?.reminderTime ?? "09:00"}
    />
  );
}
