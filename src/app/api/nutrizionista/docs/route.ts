import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { initNutrizionistaTables } from "@/lib/init-tables";

export const runtime = "nodejs";

type DocRow = { id: string; title: string; mimeType: string; size: number; createdAt: string };

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await initNutrizionistaTables();

  const docs = await prisma.$queryRawUnsafe<DocRow[]>(
    `SELECT id, title, "mimeType", size, "createdAt" FROM "NutrizionistaDoc" WHERE "userId" = $1 ORDER BY "createdAt" DESC`,
    session.user.id
  );

  return NextResponse.json({ docs });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await initNutrizionistaTables();

  const { title, mimeType, data, size } = await req.json();
  if (!title || !data) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  if (size > 5 * 1024 * 1024) return NextResponse.json({ error: "File troppo grande (max 5MB)" }, { status: 400 });

  const id = `nd_${Math.random().toString(36).slice(2, 11)}`;
  await prisma.$executeRawUnsafe(
    `INSERT INTO "NutrizionistaDoc" ("id","userId","title","mimeType","data","size","createdAt") VALUES ($1,$2,$3,$4,$5,$6,NOW())`,
    id, session.user.id, title, mimeType || "application/octet-stream", data, size ?? 0
  );

  return NextResponse.json({ id, title, mimeType, size, createdAt: new Date().toISOString() });
}
