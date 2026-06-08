import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

type DocFull = { id: string; title: string; mimeType: string; data: string; size: number };

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const rows = await prisma.$queryRawUnsafe<DocFull[]>(
    `SELECT id, title, "mimeType", data, size FROM "NutrizionistaDoc" WHERE "id" = $1 AND "userId" = $2`,
    id, session.user.id
  );

  if (!rows.length) return new Response("Not found", { status: 404 });

  const doc = rows[0];
  const buffer = Buffer.from(doc.data, "base64");

  return new Response(buffer, {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(doc.title)}"`,
      "Content-Length": String(buffer.length),
    },
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.$executeRawUnsafe(
    `DELETE FROM "NutrizionistaDoc" WHERE "id" = $1 AND "userId" = $2`,
    id, session.user.id
  );

  return NextResponse.json({ ok: true });
}
