import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkAndAwardRoutineRewards } from "@/lib/rewards";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const { id: habitId } = await params;
  const habit = await prisma.habit.findFirst({
    where: { id: habitId, userId: session.user.id },
  });
  if (!habit)
    return NextResponse.json({ error: "Abitudine non trovata" }, { status: 404 });

  const today = new Date().toISOString().slice(0, 10);
  const existing = await prisma.habitLog.findUnique({
    where: { habitId_date: { habitId, date: today } },
  });

  if (existing) {
    await prisma.habitLog.delete({ where: { id: existing.id } });
    return NextResponse.json({ checked: false });
  }

  await prisma.habitLog.create({ data: { habitId, date: today } });

  await prisma.user.update({
    where: { id: session.user.id },
    data: { points: { increment: 5 } },
  });

  await checkAndAwardRoutineRewards(session.user.id);

  return NextResponse.json({ checked: true });
}
