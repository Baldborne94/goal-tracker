import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { statForCategory, statPointsFromXp } from "@/lib/hero-stats";
import { awardStat } from "@/lib/hero-stats-server";
import { checkAndAwardRewards } from "@/lib/rewards";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const goal = await prisma.goal.findFirst({
    where: { id, userId: session.user.id },
    include: {
      category: true,
      milestones: { orderBy: { order: "asc" } },
      tags: { include: { tag: true } },
    },
  });

  if (!goal)
    return NextResponse.json({ error: "Goal not found" }, { status: 404 });

  return NextResponse.json(goal);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { title, description, priority, targetDate, categoryId, progress, status, reminderTime, reminderFrequency, reminderDay, reminderDays, isRecurring, recurrenceType, dailyCheckIn, checkInXP, checkInDays, healthMetric, healthTarget, milestonesKept, milestonesAdded } = body;

  const existing = await prisma.goal.findFirst({
    where: { id, userId: session.user.id },
    include: { milestones: { orderBy: { order: "asc" } }, category: true },
  });
  if (!existing)
    return NextResponse.json({ error: "Goal not found" }, { status: 404 });

  const wasCompleted = existing.status === "completed";
  const isNowComplete = status === "completed" || progress === 100;

  // Block manual completion of daily check-in quests that haven't reached 100%
  if (isNowComplete && !wasCompleted) {
    const [ciRow] = await prisma.$queryRawUnsafe<{ dailyCheckIn: boolean; progress: number }[]>(
      `SELECT "dailyCheckIn", progress FROM "Goal" WHERE id = $1`, id
    ).catch(() => [] as { dailyCheckIn: boolean; progress: number }[]);
    if (ciRow?.dailyCheckIn && ciRow.progress < 100) {
      return NextResponse.json({ error: "Complete all check-ins before finishing this quest" }, { status: 400 });
    }
  }

  const goal = await prisma.goal.update({
    where: { id },
    data: {
      title,
      description,
      priority,
      targetDate: targetDate ? new Date(targetDate) : existing.targetDate,
      categoryId: categoryId === "" ? null : categoryId,
      progress,
      status,
      reminderTime: reminderTime !== undefined ? (reminderTime || null) : existing.reminderTime,
      reminderFrequency: reminderTime !== undefined
        ? (reminderTime ? (reminderFrequency || "daily") : null)
        : existing.reminderFrequency,
      reminderDay: reminderTime !== undefined
        ? (reminderTime && reminderDay != null ? parseInt(String(reminderDay)) : null)
        : existing.reminderDay,
      reminderDays: reminderTime !== undefined
        ? (reminderTime && reminderFrequency === "custom" ? (reminderDays || null) : null)
        : (existing as typeof existing & { reminderDays?: string | null }).reminderDays,
      isRecurring: isRecurring !== undefined ? !!isRecurring : existing.isRecurring,
      recurrenceType: isRecurring !== undefined
        ? (isRecurring ? (recurrenceType || "monthly") : null)
        : existing.recurrenceType,
      completedAt:
        isNowComplete && !wasCompleted ? new Date() : existing.completedAt,
    },
    include: {
      category: true,
      milestones: { orderBy: { order: "asc" } },
      tags: { include: { tag: true } },
    },
  });

  // Update dailyCheckIn fields via raw SQL (bypasses Prisma type limitations for newer columns)
  if (dailyCheckIn !== undefined) {
    await prisma.$executeRawUnsafe(
      `UPDATE "Goal" SET "dailyCheckIn" = $1, "checkInXP" = $2, "checkInDays" = $3 WHERE id = $4`,
      !!dailyCheckIn,
      dailyCheckIn ? (parseInt(String(checkInXP)) || 5) : 5,
      dailyCheckIn ? (checkInDays ?? null) : null,
      id
    );
  }

  // Metrica Salute collegata: disattivare il check-in giornaliero scollega
  // anche la spunta automatica, altrimenti resterebbe attiva e invisibile.
  if (healthMetric !== undefined || dailyCheckIn !== undefined) {
    const linked = dailyCheckIn === false ? null : (healthMetric || null);
    await prisma.$executeRawUnsafe(
      `UPDATE "Goal" SET "healthMetric" = $1, "healthTarget" = $2 WHERE id = $3`,
      linked,
      linked ? (Number(healthTarget) || null) : null,
      id
    ).catch(() => {});
  }

  // Handle milestone edits
  if (milestonesKept !== undefined || milestonesAdded?.length > 0) {
    if (milestonesKept !== undefined) {
      await prisma.milestone.deleteMany({
        where: { goalId: id, completed: false, id: { notIn: milestonesKept } },
      });
    }
    if (milestonesAdded?.length > 0) {
      const last = await prisma.milestone.findFirst({ where: { goalId: id }, orderBy: { order: "desc" }, select: { order: true } });
      const startOrder = (last?.order ?? -1) + 1;
      await prisma.milestone.createMany({
        data: (milestonesAdded as string[]).map((title: string, i: number) => ({ title, goalId: id, order: startOrder + i })),
      });
    }
    // Recalculate progress after milestone changes
    const all = await prisma.milestone.findMany({ where: { goalId: id } });
    if (all.length > 0) {
      const done = all.filter((m: { completed: boolean }) => m.completed).length;
      const newProgress = Math.round((done / all.length) * 100);
      await prisma.goal.update({ where: { id }, data: { progress: newProgress } });
    }
  }

  // award points and badges when completing
  if (isNowComplete && !wasCompleted) {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { points: { increment: existing.points } },
    });
    await checkAndAwardRewards(session.user.id);

    // Auto-clone recurring quests on manual completion
    const isRec = (existing as typeof existing & { isRecurring?: boolean }).isRecurring;
    const recType = (existing as typeof existing & { recurrenceType?: string }).recurrenceType;
    if (isRec) {
      const nextTargetDate = existing.targetDate ? (() => {
        const d = new Date(existing.targetDate!);
        if (recType === "weekly") {
          d.setDate(d.getDate() + 7);
        } else {
          const od = d.getDate();
          d.setMonth(d.getMonth() + 1);
          if (d.getDate() !== od) d.setDate(0);
        }
        return d;
      })() : null;

      const [ci] = await prisma.$queryRawUnsafe<{ dailyCheckIn: boolean; checkInXP: number; checkInDays: string | null }[]>(
        `SELECT "dailyCheckIn", "checkInXP", "checkInDays" FROM "Goal" WHERE id = $1`, id
      ).catch(() => [] as { dailyCheckIn: boolean; checkInXP: number; checkInDays: string | null }[]);

      const newGoal = await prisma.goal.create({
        data: {
          title: existing.title,
          description: existing.description,
          priority: existing.priority,
          targetDate: nextTargetDate,
          categoryId: existing.categoryId,
          userId: session.user.id,
          points: existing.points,
          reminderTime: existing.reminderTime,
          reminderFrequency: (existing as typeof existing & { reminderFrequency?: string }).reminderFrequency,
          reminderDay: (existing as typeof existing & { reminderDay?: number }).reminderDay,
          reminderDays: (existing as typeof existing & { reminderDays?: string }).reminderDays,
          isRecurring: true,
          recurrenceType: recType,
          milestones: {
            create: existing.milestones.map((m, i) => ({ title: m.title, order: i })),
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
  }

  // Il registro della scheda per ultimo: è un livello di gioco sopra il
  // completamento, non un passo del completamento.
  if (isNowComplete && !wasCompleted) {
    await awardStat(
      session.user.id,
      statForCategory(existing.category?.name),
      statPointsFromXp(existing.points),
      "quest",
      `Missione «${existing.title}» completata`
    );
  }

  return NextResponse.json(goal);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.goal.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing)
    return NextResponse.json({ error: "Goal not found" }, { status: 404 });

  await prisma.goal.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
