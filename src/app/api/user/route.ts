import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, points: true, createdAt: true, userRewards: { include: { reward: true }, orderBy: { earnedAt: "desc" } } },
  });
  return NextResponse.json(user);
}
