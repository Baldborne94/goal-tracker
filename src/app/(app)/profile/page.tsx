import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import ProfileClient from "@/components/ProfileClient";

export default async function ProfilePage() {
  const session = await auth();
  const userId = session!.user!.id!;

  const [user, completed, active] = await Promise.all([
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
  ]);

  const stats = {
    total: completed + active,
    completed,
    active,
  };

  return (
    <ProfileClient
      user={JSON.parse(JSON.stringify(user))}
      stats={stats}
    />
  );
}
