import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  await prisma.$executeRawUnsafe(
    `DELETE FROM "BodyMeasurement" WHERE id = $1 AND "userId" = $2`, id, session.user.id
  );
  return new NextResponse(null, { status: 204 });
}
