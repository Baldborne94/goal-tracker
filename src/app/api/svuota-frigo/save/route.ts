import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { initSvuotaFrigoTable } from "@/lib/init-tables";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ingredients, content } = await req.json() as { ingredients: string[]; content: string };
  if (!ingredients?.length || !content?.trim()) {
    return NextResponse.json({ error: "Dati mancanti" }, { status: 400 });
  }

  await initSvuotaFrigoTable();
  const id = randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "SvuotaFrigoRecipe" ("id", "userId", "ingredients", "content", "createdAt") VALUES ($1, $2, $3, $4, NOW())`,
    id, session.user.id, JSON.stringify(ingredients), content.trim()
  );

  const [recipe] = await prisma.$queryRawUnsafe<
    { id: string; ingredients: string; content: string; createdAt: Date }[]
  >(
    `SELECT id, ingredients, content, "createdAt" FROM "SvuotaFrigoRecipe" WHERE id = $1`,
    id
  );

  return NextResponse.json({ ...recipe, ingredients: JSON.parse(recipe.ingredients) as string[] });
}
