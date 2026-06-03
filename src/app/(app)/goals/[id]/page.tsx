import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { formatDate, getPriorityColor, getPriorityLabel } from "@/lib/utils";
import GoalDetailClient from "@/components/goals/GoalDetailClient";

export default async function GoalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const { id } = await params;

  const goal = await prisma.goal.findFirst({
    where: { id, userId: session!.user!.id! },
    include: {
      category: true,
      milestones: { orderBy: { order: "asc" } },
      tags: { include: { tag: true } },
    },
  });

  if (!goal) notFound();

  type CheckIn = { id: string; date: string; note: string | null; xpAwarded: number };
  let checkIns: CheckIn[] = [];

  if ((goal as typeof goal & { dailyCheckIn?: boolean }).dailyCheckIn) {
    try {
      checkIns = await prisma.$queryRawUnsafe<CheckIn[]>(
        `SELECT id, date, note, "xpAwarded" FROM "QuestCheckIn" WHERE "goalId" = $1 AND "userId" = $2 ORDER BY date DESC LIMIT 90`,
        id, session!.user!.id!
      );
    } catch { /* table not yet created — first check-in call will create it */ }
  }

  return (
    <GoalDetailClient
      goal={JSON.parse(JSON.stringify(goal))}
      priorityLabel={getPriorityLabel(goal.priority)}
      priorityColor={getPriorityColor(goal.priority)}
      formattedDate={goal.targetDate ? formatDate(goal.targetDate) : null}
      checkIns={checkIns}
    />
  );
}
