import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const goals = await prisma.goal.findMany({
    where: { userId: session.user.id },
    include: {
      category: true,
      milestones: { orderBy: { order: "asc" } },
      tags: { include: { tag: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(goals);
}

function calculatePoints(priority: string, milestonesCount: number, hasDescription: boolean, hasTargetDate: boolean): number {
  const base: Record<string, number> = { low: 15, medium: 30, high: 60 };
  let pts = base[priority] ?? 30;
  if (hasTargetDate) pts += 10;
  pts += Math.min(milestonesCount, 5) * 5;
  if (hasDescription) pts += 5;
  return pts;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { title, description, priority, targetDate, categoryId, tags, milestones, reminderTime, reminderFrequency, reminderDay, reminderDays, isRecurring, recurrenceType, dailyCheckIn, checkInXP, checkInDays, healthMetric, healthTarget } = body;

  if (!title)
    return NextResponse.json({ error: "Title is required" }, { status: 400 });

  const resolvedPriority = priority || "medium";
  const points = calculatePoints(
    resolvedPriority,
    milestones?.length ?? 0,
    !!description?.trim(),
    !!targetDate
  );

  const goal = await prisma.goal.create({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: {
      title,
      description,
      priority: resolvedPriority,
      targetDate: targetDate ? new Date(targetDate) : null,
      categoryId: categoryId || null,
      userId: session.user.id,
      points,
      dailyCheckIn: !!dailyCheckIn,
      checkInXP: dailyCheckIn ? (parseInt(String(checkInXP)) || 5) : 5,
      checkInDays: dailyCheckIn ? (checkInDays || null) : null,
      reminderTime: reminderTime || null,
      reminderFrequency: reminderTime ? (reminderFrequency || "daily") : null,
      reminderDay: reminderTime && reminderDay != null ? parseInt(String(reminderDay)) : null,
      reminderDays: reminderTime && reminderFrequency === "custom" ? (reminderDays || null) : null,
      isRecurring: !!isRecurring,
      recurrenceType: isRecurring ? (recurrenceType || "monthly") : null,
      tags: tags?.length
        ? {
            create: tags.map((tagName: string) => ({
              tag: {
                connectOrCreate: {
                  where: { name: tagName },
                  create: { name: tagName },
                },
              },
            })),
          }
        : undefined,
      milestones: milestones?.length
        ? {
            create: milestones.map((m: string, i: number) => ({
              title: m,
              order: i,
            })),
          }
        : undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    include: {
      category: true,
      milestones: true,
      tags: { include: { tag: true } },
    },
  });

  // Collegamento alla metrica Salute via SQL grezzo: se il DB non ha ancora le
  // colonne (seed non eseguito), la missione viene comunque creata.
  if (healthMetric) {
    await prisma.$executeRawUnsafe(
      `UPDATE "Goal" SET "healthMetric" = $1, "healthTarget" = $2 WHERE id = $3`,
      String(healthMetric),
      Number(healthTarget) || null,
      goal.id
    ).catch(() => {});
  }

  return NextResponse.json(goal, { status: 201 });
}
