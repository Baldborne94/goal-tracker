import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
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

  await prisma.user.update({
    where: { id: session.user.id },
    data: { points: { increment: 10 } },
  });

  await checkAndAwardPesoRewards(session.user.id);

  return NextResponse.json(entry, { status: 201 });
}
