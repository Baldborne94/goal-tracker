import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import ProfileClient from "@/components/ProfileClient";

export default async function ProfilePage() {
  const session = await auth();
  const userId = session!.user!.id!;

  const [user, goalsStats] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRewards: {
          include: { reward: true },
          orderBy: { earnedAt: "desc" },
        },
      },
    }),
    prisma.goal.groupBy({
      by: ["status"],
      where: { userId },
      _count: true,
    }),
  ]);

  const stats = {
    total: goalsStats.reduce((a, b) => a + b._count, 0),
    completed: goalsStats.find((s) => s.status === "completed")?._count || 0,
    active: goalsStats.find((s) => s.status === "active")?._count || 0,
  };

  return (
    <ProfileClient
      user={JSON.parse(JSON.stringify(user))}
      stats={stats}
    />
  );
}
