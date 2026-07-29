import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { serverDayKey } from "@/lib/utils";

type FoodEntryRow = {
  id: string; mealType: string; foodName: string; grams: number;
  kcalPer100g: number; kcal: number;
  proteins: number; carbs: number; fat: number;
  createdAt: string;
};

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
      proteins REAL NOT NULL DEFAULT 0,
      carbs REAL NOT NULL DEFAULT 0,
      fat REAL NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "FoodEntry_pkey" PRIMARY KEY (id),
      CONSTRAINT "FoodEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);
  await prisma.$executeRawUnsafe(`ALTER TABLE "FoodEntry" ADD COLUMN IF NOT EXISTS proteins REAL NOT NULL DEFAULT 0`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "FoodEntry" ADD COLUMN IF NOT EXISTS carbs REAL NOT NULL DEFAULT 0`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "FoodEntry" ADD COLUMN IF NOT EXISTS fat REAL NOT NULL DEFAULT 0`);
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const date = new URL(req.url).searchParams.get("date") || serverDayKey();

  if (!tableReady) { await ensureTable().catch(() => {}); tableReady = true; }

  const entries = await prisma.$queryRawUnsafe<FoodEntryRow[]>(
    `SELECT id, "mealType", "foodName", grams, "kcalPer100g", kcal,
      COALESCE(proteins, 0) AS proteins, COALESCE(carbs, 0) AS carbs, COALESCE(fat, 0) AS fat
     FROM "FoodEntry" WHERE "userId" = $1 AND date = $2 ORDER BY "createdAt" ASC`,
    session.user.id, date
  ).catch(() => [] as FoodEntryRow[]);

  return NextResponse.json(entries);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { date, mealType, foodName, grams, kcalPer100g, proteins, carbs, fat } = body as Record<string, unknown>;

  if (!mealType || !foodName || !grams || !kcalPer100g) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  if (!tableReady) { await ensureTable(); tableReady = true; }

  const g = Number(grams);
  const kp = Number(kcalPer100g);
  const pr = Number(proteins ?? 0);
  const ca = Number(carbs ?? 0);
  const fa = Number(fat ?? 0);
  const kcal = Math.round((g * kp) / 100);
  const id = `fe_${Math.random().toString(36).slice(2, 11)}`;
  const d = String(date || serverDayKey());

  await prisma.$executeRawUnsafe(
    `INSERT INTO "FoodEntry" (id, "userId", date, "mealType", "foodName", grams, "kcalPer100g", kcal, proteins, carbs, fat)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    id, session.user.id, d, mealType, foodName, g, kp, kcal, pr, ca, fa
  );

  return NextResponse.json({ id, mealType, foodName, grams: g, kcalPer100g: kp, kcal, proteins: pr, carbs: ca, fat: fa });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const date = url.searchParams.get("date");
  const mealType = url.searchParams.get("mealType");
  const foodNamesRaw = url.searchParams.get("foodNames");

  if (!date || !mealType || !foodNamesRaw) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const foodNames = foodNamesRaw.split(",").map(n => n.trim()).filter(Boolean);
  if (!foodNames.length) return NextResponse.json({ ok: true });

  if (!tableReady) { await ensureTable().catch(() => {}); tableReady = true; }

  const placeholders = foodNames.map((_, i) => `$${i + 4}`).join(", ");
  await prisma.$executeRawUnsafe(
    `DELETE FROM "FoodEntry" WHERE "userId" = $1 AND date = $2 AND "mealType" = $3 AND "foodName" IN (${placeholders})`,
    session.user.id, date, mealType, ...foodNames
  ).catch(() => {});

  return NextResponse.json({ ok: true });
}
