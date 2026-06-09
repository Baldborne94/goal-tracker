import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.$executeRawUnsafe(
    `DELETE FROM "SvuotaFrigoRecipe" WHERE id = $1 AND "userId" = $2`,
    id, session.user.id
  );

  return NextResponse.json({ ok: true });
}
