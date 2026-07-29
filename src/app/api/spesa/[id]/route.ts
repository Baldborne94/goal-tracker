import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { initSpesaTables } from "@/lib/init-tables";

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await initSpesaTables();
  const body = await req.json();

  if (typeof body.checked === "boolean") {
    // checkedAt è ciò che rende la sfida "spunta 3 prodotti" una sfida di
    // oggi: senza, contava le spunte di sempre e si regalava ogni mattina.
    await prisma.$executeRawUnsafe(
      `UPDATE "ShoppingItem" SET "checked" = $1, "checkedAt" = $2 WHERE "id" = $3 AND "userId" = $4`,
      body.checked, body.checked ? new Date() : null, id, session.user.id
    );
  } else if (body.name !== undefined) {
    await prisma.$executeRawUnsafe(
      `UPDATE "ShoppingItem" SET "name" = $1, "quantity" = $2 WHERE "id" = $3 AND "userId" = $4`,
      body.name.trim(), body.quantity?.trim() || null, id, session.user.id
    );
  }

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
