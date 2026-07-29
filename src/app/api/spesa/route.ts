import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { initSpesaTables } from "@/lib/init-tables";

export const runtime = "nodejs";

type Row = { id: string; name: string; quantity: string | null; checked: boolean; category: string; createdAt: string };

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await initSpesaTables();

  const items = await prisma.$queryRawUnsafe<Row[]>(
    `SELECT id, name, quantity, checked, category, "createdAt" FROM "ShoppingItem" WHERE "userId" = $1 ORDER BY "createdAt" ASC`,
    session.user.id
  );

  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await initSpesaTables();

  const { name, quantity, category } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const id = `si_${Math.random().toString(36).slice(2, 11)}`;
  const cat = category || "altro";
  await prisma.$executeRawUnsafe(
    `INSERT INTO "ShoppingItem" ("id","userId","name","quantity","checked","category","createdAt") VALUES ($1,$2,$3,$4,false,$5,NOW())`,
    id, session.user.id, name.trim(), quantity?.trim() || null, cat
  );

  return NextResponse.json({ id, name: name.trim(), quantity: quantity?.trim() || null, checked: false, category: cat });
}
