import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

async function calcProgress(
  goalId: string,
  guideType: string,
  guideTarget: number | null,
  guideStart: number | null
): Promise<number> {
  if (!guideTarget) return 0;

  if (guideType === "finance") {
    const entries = await prisma.expense.findMany({ where: { goalId } });
    const total = entries.reduce((s, e) => s + e.amount, 0);
    return Math.min(100, Math.round((total / guideTarget) * 100));
  }

  if (guideType === "weight") {
    const entries = await prisma.weightEntry.findMany({
      where: { goalId },
      orderBy: { date: "desc" },
    });
    if (!entries.length) return 0;
    const start = guideStart ?? entries[entries.length - 1].weight;
    const current = entries[0].weight;
    if (start === guideTarget) return 100;
    const isLosing = guideTarget < start;
    if (isLosing) {
      return Math.min(100, Math.max(0, Math.round(((start - current) / (start - guideTarget)) * 100)));
    }
    return Math.min(100, Math.max(0, Math.round(((current - start) / (guideTarget - start)) * 100)));
  }

  if (guideType === "habits") {
    const habits = await prisma.habit.findMany({
      where: { goalId },
      include: { logs: true },
    });
    if (!habits.length) return 0;
    const allDates = new Set(habits.flatMap((h) => h.logs.map((l) => l.date)));
    return Math.min(100, Math.round((allDates.size / guideTarget) * 100));
  }

  return 0;
}

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
  });
  if (!goal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { guideType, guideTarget, guideStart } = goal;
  if (!guideType) return NextResponse.json({ type: null });

  if (guideType === "finance") {
    const entries = await prisma.expense.findMany({
      where: { goalId: id },
      orderBy: { date: "desc" },
    });
    const total = entries.reduce((s, e) => s + e.amount, 0);
    const progress = guideTarget ? Math.min(100, Math.round((total / guideTarget) * 100)) : 0;
    return NextResponse.json({ type: "finance", entries, total, target: guideTarget, progress });
  }

  if (guideType === "weight") {
    const entries = await prisma.weightEntry.findMany({
      where: { goalId: id },
      orderBy: { date: "desc" },
    });
    const start = guideStart ?? entries[entries.length - 1]?.weight ?? null;
    const current = entries[0]?.weight ?? null;
    const target = guideTarget;
    let progress = 0;
    if (start !== null && current !== null && target !== null && start !== target) {
      const isLosing = target < start;
      progress = isLosing
        ? Math.min(100, Math.max(0, Math.round(((start - current) / (start - target)) * 100)))
        : Math.min(100, Math.max(0, Math.round(((current - start) / (target - start)) * 100)));
    }
    return NextResponse.json({ type: "weight", entries, start, current, target, progress });
  }

  if (guideType === "habits") {
    const habits = await prisma.habit.findMany({
      where: { goalId: id },
      include: { logs: { orderBy: { date: "desc" } } },
    });
    const allDates = new Set(habits.flatMap((h) => h.logs.map((l) => l.date)));
    const totalDays = allDates.size;
    const target = guideTarget ?? 30;
    const progress = Math.min(100, Math.round((totalDays / target) * 100));
    const today = new Date().toISOString().slice(0, 10);
    return NextResponse.json({ type: "habits", habits, totalDays, target, progress, today });
  }

  return NextResponse.json({ type: null });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const goal = await prisma.goal.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!goal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { guideType, guideTarget, guideStart } = goal;

  if (guideType === "finance") {
    const { amount, description } = body;
    if (!amount || parseFloat(amount) <= 0)
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    await prisma.expense.create({
      data: {
        userId: session.user.id,
        goalId: id,
        amount: parseFloat(amount),
        category: "savings",
        description: description || null,
      },
    });
  } else if (guideType === "weight") {
    const { weight, note } = body;
    if (!weight || isNaN(parseFloat(weight)))
      return NextResponse.json({ error: "Invalid weight" }, { status: 400 });
    await prisma.weightEntry.create({
      data: {
        userId: session.user.id,
        goalId: id,
        weight: parseFloat(weight),
        note: note || null,
      },
    });
    if (!guideStart) {
      await prisma.goal.update({ where: { id }, data: { guideStart: parseFloat(weight) } });
    }
  } else if (guideType === "habits") {
    const { habitName, habitIcon } = body;
    if (!habitName?.trim())
      return NextResponse.json({ error: "Name required" }, { status: 400 });
    await prisma.habit.create({
      data: {
        userId: session.user.id,
        goalId: id,
        name: habitName.trim(),
        icon: habitIcon || "🔁",
      },
    });
  } else {
    return NextResponse.json({ error: "No guide set" }, { status: 400 });
  }

  const updatedGoal = await prisma.goal.findFirst({ where: { id } });
  const progress = await calcProgress(id, guideType!, guideTarget, updatedGoal?.guideStart ?? guideStart);
  await prisma.goal.update({
    where: { id },
    data: { progress, status: progress >= 100 ? "completed" : "active" },
  });

  if (guideType === "finance") {
    const entries = await prisma.expense.findMany({ where: { goalId: id }, orderBy: { date: "desc" } });
    const total = entries.reduce((s, e) => s + e.amount, 0);
    return NextResponse.json({ type: "finance", entries, total, target: guideTarget, progress });
  }
  if (guideType === "weight") {
    const entries = await prisma.weightEntry.findMany({ where: { goalId: id }, orderBy: { date: "desc" } });
    const start = updatedGoal?.guideStart ?? guideStart ?? entries[entries.length - 1]?.weight ?? null;
    const current = entries[0]?.weight ?? null;
    return NextResponse.json({ type: "weight", entries, start, current, target: guideTarget, progress });
  }
  if (guideType === "habits") {
    const habits = await prisma.habit.findMany({ where: { goalId: id }, include: { logs: { orderBy: { date: "desc" } } } });
    const allDates = new Set(habits.flatMap((h) => h.logs.map((l) => l.date)));
    const today = new Date().toISOString().slice(0, 10);
    return NextResponse.json({ type: "habits", habits, totalDays: allDates.size, target: guideTarget, progress, today });
  }

  return NextResponse.json({ progress });
}
