import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import DietClient from "@/components/diet/DietClient";

type FoodEntryRow = { id: string; mealType: string; foodName: string; grams: number; kcalPer100g: number; kcal: number };

export default async function DietPage() {
  const session = await auth();
  const userId = session!.user!.id!;

  const today = new Date().toISOString().slice(0, 10);

  const [logs, weights, foodEntries] = await Promise.all([
    prisma.mealLog.findMany({
      where: { userId, date: today },
      orderBy: { createdAt: "asc" },
    }),
    prisma.weightEntry.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      take: 14,
    }),
    prisma.$queryRawUnsafe<FoodEntryRow[]>(
      `SELECT id, "mealType", "foodName", grams, "kcalPer100g", kcal FROM "FoodEntry" WHERE "userId" = $1 AND date = $2 ORDER BY "createdAt" ASC`,
      userId, today
    ).catch(() => [] as FoodEntryRow[]),
  ]);

  return (
    <DietClient
      initialDate={today}
      initialLogs={JSON.parse(JSON.stringify(logs))}
      recentWeights={JSON.parse(JSON.stringify(weights))}
      initialFoodEntries={foodEntries}
    />
  );
}
