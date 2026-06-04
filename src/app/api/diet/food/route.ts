import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

type FoodEntryRow = { id: string; mealType: string; foodName: string; grams: number; kcalPer100g: number; kcal: number; createdAt: string };

let tableReady = false;

async function ensureTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "FoodEntry" (
      id TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      date TEXT NOT NULL,
      "mealType" TEXT NOT NULL,
      "foodName" TEXT NOT NULL,
      grams REAL NOT NULL,
      "kcalPer100g" REAL NOT NULL,
      kcal REAL NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "FoodEntry_pkey" PRIMARY KEY (id),
      CONSTRAINT "FoodEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const date = new URL(req.url).searchParams.get("date") || new Date().toISOString().slice(0, 10);

  if (!tableReady) { await ensureTable().catch(() => {}); tableReady = true; }

  const entries = await prisma.$queryRawUnsafe<FoodEntryRow[]>(
    `SELECT id, "mealType", "foodName", grams, "kcalPer100g", kcal FROM "FoodEntry" WHERE "userId" = $1 AND date = $2 ORDER BY "createdAt" ASC`,
    session.user.id, date
  ).catch(() => [] as FoodEntryRow[]);

  return NextResponse.json(entries);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { date, mealType, foodName, grams, kcalPer100g } = body as Record<string, unknown>;

  if (!mealType || !foodName || !grams || !kcalPer100g) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  if (!tableReady) { await ensureTable(); tableReady = true; }

  const g = Number(grams);
  const kp = Number(kcalPer100g);
  const kcal = Math.round((g * kp) / 100);
  const id = `fe_${Math.random().toString(36).slice(2, 11)}`;
  const d = String(date || new Date().toISOString().slice(0, 10));

  await prisma.$executeRawUnsafe(
    `INSERT INTO "FoodEntry" (id, "userId", date, "mealType", "foodName", grams, "kcalPer100g", kcal) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    id, session.user.id, d, mealType, foodName, g, kp, kcal
  );

  return NextResponse.json({ id, mealType, foodName, grams: g, kcalPer100g: kp, kcal });
}
