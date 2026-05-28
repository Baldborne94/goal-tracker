import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkAndAwardRoutineRewards } from "@/lib/rewards";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000)
    .toISOString()
    .slice(0, 10);

  const habits = await prisma.habit.findMany({
    where: { userId: session.user.id },
    include: {
      logs: {
        where: { date: { gte: thirtyDaysAgo } },
        orderBy: { date: "desc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(habits);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const { name, icon } = await req.json();
  if (!name?.trim())
    return NextResponse.json({ error: "Nome obbligatorio" }, { status: 400 });

  const habit = await prisma.habit.create({
    data: {
      userId: session.user.id,
      name: name.trim(),
      icon: icon || "🔁",
    },
    include: { logs: true },
  });

  await checkAndAwardRoutineRewards(session.user.id);

  return NextResponse.json(habit, { status: 201 });
}
