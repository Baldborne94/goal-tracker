import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Link from "next/link";
import GoalsList from "@/components/goals/GoalsList";

export default async function GoalsPage() {
  const session = await auth();
  const userId = session!.user!.id!;

  const [goals, categories, heroClassRow] = await Promise.all([
    prisma.goal.findMany({
      where: { userId },
      include: {
        category: true,
        milestones: { orderBy: { order: "asc" } },
        tags: { include: { tag: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.$queryRawUnsafe<{ heroClass: string | null }[]>(
      `SELECT "heroClass" FROM "User" WHERE id = $1`, userId
    ).catch(() => [{ heroClass: null }]),
  ]);
  const heroClass = heroClassRow[0]?.heroClass ?? null;

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#ede9ff]">⚔️ Missioni</h1>
        <Link
          href="/goals/new"
          className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-400 text-black rounded-xl text-sm font-bold shadow-lg shadow-amber-900/30"
        >
          + Nuova
        </Link>
      </div>

      <GoalsList goals={JSON.parse(JSON.stringify(goals))} categories={categories} heroClass={heroClass} />
    </div>
  );
}
