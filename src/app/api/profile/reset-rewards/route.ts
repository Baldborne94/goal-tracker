import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;
  await prisma.userReward.deleteMany({ where: { userId } });
  await prisma.user.update({ where: { id: userId }, data: { points: 0 } });
  return NextResponse.json({ success: true });
}
