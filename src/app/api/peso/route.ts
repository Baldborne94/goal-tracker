import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { awardStat } from "@/lib/hero-stats-server";
import { dayRange } from "@/lib/utils";
import { checkAndAwardPesoRewards } from "@/lib/rewards";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const entries = await prisma.weightEntry.findMany({
    where: { userId: session.user.id },
    orderBy: { date: "desc" },
  });

  return NextResponse.json(entries);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { weight, note, date } = await req.json();
  if (!weight || isNaN(parseFloat(weight)))
    return NextResponse.json({ error: "Invalid weight" }, { status: 400 });

  const entry = await prisma.weightEntry.create({
    data: {
      userId: session.user.id,
      weight: parseFloat(weight),
      note: note || null,
      date: date ? new Date(date) : new Date(),
    },
  });

  // Una pesata al giorno vale XP: senza questo controllo bastava premere
  // "salva" dieci volte per incassare 100 XP e falsare la Costituzione
  // della scheda, che pesca dalla stessa fonte.
  const { start, end } = dayRange();
  const alreadyToday = await prisma.weightEntry.count({
    where: { userId: session.user.id, createdAt: { gte: start, lt: end }, id: { not: entry.id } },
  });

  if (alreadyToday === 0) {
    await awardStat(session.user.id, "cos", 5, "weight", "Peso registrato");
    await prisma.user.update({
      where: { id: session.user.id },
      data: { points: { increment: 10 } },
    });
  }

  await checkAndAwardPesoRewards(session.user.id);

  return NextResponse.json(entry, { status: 201 });
}
