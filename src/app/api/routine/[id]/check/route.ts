import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { serverDayKey } from "@/lib/utils";
import { checkAndAwardRoutineRewards } from "@/lib/rewards";
import { awardStat } from "@/lib/hero-stats-server";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: habitId } = await params;
  const habit = await prisma.habit.findFirst({
    where: { id: habitId, userId: session.user.id },
  });
  if (!habit)
    return NextResponse.json({ error: "Habit not found" }, { status: 404 });

  const today = serverDayKey();
  const existing = await prisma.habitLog.findUnique({
    where: { habitId_date: { habitId, date: today } },
  });

  if (existing) {
    await prisma.habitLog.delete({ where: { id: existing.id } });
    return NextResponse.json({ checked: false });
  }

  await prisma.habitLog.create({ data: { habitId, date: today } });

  // Despuntare non restituisce gli XP, quindi senza questo controllo il
  // toggle avanti-e-indietro era una macchina da XP infiniti. Il registro
  // della scheda è la memoria di ciò che è già stato pagato: la chiave è
  // l'id dell'abitudine, non il nome, così rinominarla non riapre il rubinetto.
  const source = `habit:${habitId}`;
  const alreadyPaid = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT COUNT(*) as count FROM "StatEvent"
     WHERE "userId" = $1 AND source = $2 AND date = $3`,
    session.user.id, source, today
  ).catch(() => [{ count: BigInt(0) }]);

  if (Number(alreadyPaid[0]?.count ?? 0) === 0) {
    await awardStat(session.user.id, "sag", 3, source, `Abitudine «${habit.name}» spuntata`);
    await prisma.user.update({
      where: { id: session.user.id },
      data: { points: { increment: 5 } },
    });
  }

  await checkAndAwardRoutineRewards(session.user.id);

  return NextResponse.json({ checked: true });
}
