import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
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
  const { title, description, priority, targetDate, categoryId, progress, status, reminderTime, reminderFrequency, reminderDay, reminderDays, isRecurring, recurrenceType, dailyCheckIn, checkInXP, checkInDays, milestonesKept, milestonesAdded } = body;

  const existing = await prisma.goal.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing)
    return NextResponse.json({ error: "Goal not found" }, { status: 404 });

  const wasCompleted = existing.status === "completed";
  const isNowComplete = status === "completed" || progress === 100;

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
