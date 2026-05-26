import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const { id: goalId } = await params;
  const { milestoneId, completed } = await req.json();

  const goal = await prisma.goal.findFirst({
    where: { id: goalId, userId: session.user.id },
    include: { milestones: true },
  });
  if (!goal)
    return NextResponse.json({ error: "Obiettivo non trovato" }, { status: 404 });

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

  if (progress === 100 && goal.status !== "completed") {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { points: { increment: goal.points } },
    });
  }

  return NextResponse.json({ milestone, progress });
}
