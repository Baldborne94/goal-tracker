import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import GoalForm from "@/components/goals/GoalForm";

export default async function NewGoalPage() {
  await auth();
  const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Nuovo obiettivo</h1>
      <GoalForm categories={categories} />
    </div>
  );
}
