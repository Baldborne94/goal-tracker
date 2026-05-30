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
  const { title, description, priority, targetDate, categoryId, tags, milestones, guideType, guideTarget } = body;

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
    data: {
      title,
      description,
      priority: resolvedPriority,
      targetDate: targetDate ? new Date(targetDate) : null,
      categoryId: categoryId || null,
      userId: session.user.id,
      points,
      guideType: guideType || null,
      guideTarget: guideTarget ? parseFloat(String(guideTarget)) : null,
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
    },
    include: {
      category: true,
      milestones: true,
      tags: { include: { tag: true } },
    },
  });

  return NextResponse.json(goal, { status: 201 });
}
