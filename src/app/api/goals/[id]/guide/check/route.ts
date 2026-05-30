import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: goalId } = await params;
  const { habitId } = await req.json();

  const goal = await prisma.goal.findFirst({
    where: { id: goalId, userId: session.user.id },
  });
  if (!goal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const habit = await prisma.habit.findFirst({
    where: { id: habitId, userId: session.user.id, goalId },
  });
  if (!habit) return NextResponse.json({ error: "Habit not found" }, { status: 404 });

  const today = new Date().toISOString().slice(0, 10);
  const existing = await prisma.habitLog.findUnique({
    where: { habitId_date: { habitId, date: today } },
  });

  if (existing) {
    await prisma.habitLog.delete({ where: { id: existing.id } });
  } else {
    await prisma.habitLog.create({ data: { habitId, date: today } });
    await prisma.user.update({
      where: { id: session.user.id },
      data: { points: { increment: 5 } },
    });
  }

  const habits = await prisma.habit.findMany({
    where: { goalId },
    include: { logs: true },
  });
  const allDates = new Set(habits.flatMap((h) => h.logs.map((l) => l.date)));
  const progress = Math.min(100, Math.round((allDates.size / (goal.guideTarget ?? 30)) * 100));

  await prisma.goal.update({
    where: { id: goalId },
    data: { progress, status: progress >= 100 ? "completed" : "active" },
  });

  return NextResponse.json({ checked: !existing, progress });
}
