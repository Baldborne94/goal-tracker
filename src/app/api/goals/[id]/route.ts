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
  const { title, description, priority, targetDate, categoryId, progress, status } = body;

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
      categoryId,
      progress,
      status,
      completedAt:
        isNowComplete && !wasCompleted ? new Date() : existing.completedAt,
    },
    include: {
      category: true,
      milestones: { orderBy: { order: "asc" } },
      tags: { include: { tag: true } },
    },
  });

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
