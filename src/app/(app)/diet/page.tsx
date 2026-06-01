import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import DietClient from "@/components/diet/DietClient";

export default async function DietPage() {
  const session = await auth();
  const userId = session!.user!.id!;

  const today = new Date().toISOString().slice(0, 10);

  const [logs, weights] = await Promise.all([
    prisma.mealLog.findMany({
      where: { userId, date: today },
      orderBy: { createdAt: "asc" },
    }),
    prisma.weightEntry.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      take: 14,
    }),
  ]);

  return (
    <DietClient
      initialDate={today}
      initialLogs={JSON.parse(JSON.stringify(logs))}
      recentWeights={JSON.parse(JSON.stringify(weights))}
    />
  );
}
