import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.habit.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing)
    return NextResponse.json({ error: "Abitudine non trovata" }, { status: 404 });

  await prisma.habit.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
