import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { statForCategory, statPointsFromXp } from "@/lib/hero-stats";
import { awardStat } from "@/lib/hero-stats-server";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: goalId } = await params;
  const { milestoneId, completed } = await req.json();

  const goal = await prisma.goal.findFirst({
    where: { id: goalId, userId: session.user.id },
    include: { milestones: { orderBy: { order: "asc" } }, category: true },
  });
  if (!goal)
    return NextResponse.json({ error: "Goal not found" }, { status: 404 });

  const milestone = await prisma.milestone.update({
    where: { id: milestoneId },
    data: { completed, completedAt: completed ? new Date() : null },
  });

  // recalculate progress
  const updated = await prisma.milestone.findMany({ where: { goalId } });
  const done = updated.filter((m: { completed: boolean }) => m.completed).length;
  const progress = updated.length > 0 ? Math.round((done / updated.length) * 100) : 0;

  await prisma.goal.update({
    where: { id: goalId },
    data: {
      progress,
      status: progress === 100 ? "completed" : "active",
      completedAt: progress === 100 && goal.status !== "completed" ? new Date() : goal.completedAt,
    },
  });

  // Award proportional XP: delta between new and previous progress share
  const previouslyEarned = Math.round(goal.points * goal.progress / 100);
  const nowEarned = Math.round(goal.points * progress / 100);
  const delta = nowEarned - previouslyEarned;
  if (delta !== 0) {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { points: { increment: delta } },
    });
    // La scheda cresce solo in avanti: una milestone despuntata riprende
    // gli XP ma non cancella l'esperienza vissuta.
    if (delta > 0) {
      await awardStat(
        session.user.id,
        statForCategory(goal.category?.name),
        statPointsFromXp(delta),
        "milestone",
        `Milestone di «${goal.title}»`
      );
    }
  }

  // Auto-clone recurring quests when completed
  if (progress === 100 && goal.status !== "completed" && (goal as { isRecurring?: boolean }).isRecurring) {
    const nextTargetDate = goal.targetDate
      ? (() => {
          const d = new Date(goal.targetDate);
          const rt = (goal as { recurrenceType?: string }).recurrenceType;
          if (rt === "weekly") {
            d.setDate(d.getDate() + 7);
          } else {
            const originalDay = d.getDate();
            d.setMonth(d.getMonth() + 1);
            // Clamp overflow: Jan 31 + 1 month → Feb 31 overflows to Mar → clamp to Feb 28/29
            if (d.getDate() !== originalDay) d.setDate(0);
          }
          return d;
        })()
      : null;

    const [ci] = await prisma.$queryRawUnsafe<{ dailyCheckIn: boolean; checkInXP: number; checkInDays: string | null }[]>(
      `SELECT "dailyCheckIn", "checkInXP", "checkInDays" FROM "Goal" WHERE id = $1`, goalId
    ).catch(() => [] as { dailyCheckIn: boolean; checkInXP: number; checkInDays: string | null }[]);

    const newGoal = await prisma.goal.create({
      data: {
        title: goal.title,
        description: goal.description,
        priority: goal.priority,
        targetDate: nextTargetDate,
        categoryId: goal.categoryId,
        userId: session.user.id,
        points: goal.points,
        reminderTime: goal.reminderTime,
        reminderFrequency: (goal as { reminderFrequency?: string }).reminderFrequency,
        reminderDay: (goal as { reminderDay?: number }).reminderDay,
        reminderDays: (goal as { reminderDays?: string }).reminderDays,
        isRecurring: true,
        recurrenceType: (goal as { recurrenceType?: string }).recurrenceType,
        milestones: {
          create: goal.milestones.map((m, i) => ({ title: m.title, order: i })),
        },
      },
    });

    if (ci?.dailyCheckIn) {
      await prisma.$executeRawUnsafe(
        `UPDATE "Goal" SET "dailyCheckIn" = $1, "checkInXP" = $2, "checkInDays" = $3 WHERE id = $4`,
        ci.dailyCheckIn, ci.checkInXP, ci.checkInDays, newGoal.id
      );
    }
  }

  revalidatePath("/goals");
  revalidatePath("/dashboard");
  return NextResponse.json({ milestone, progress });
}
