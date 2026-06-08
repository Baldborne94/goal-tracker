import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { checked } = await req.json();

  await prisma.$executeRawUnsafe(
    `UPDATE "ShoppingItem" SET "checked" = $1 WHERE "id" = $2 AND "userId" = $3`,
    checked, id, session.user.id
  );

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.$executeRawUnsafe(
    `DELETE FROM "ShoppingItem" WHERE "id" = $1 AND "userId" = $2`,
    id, session.user.id
  );

  return NextResponse.json({ ok: true });
}
