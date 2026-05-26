import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import GoalForm from "@/components/goals/GoalForm";

export default async function EditGoalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const { id } = await params;

  const [goal, categories] = await Promise.all([
    prisma.goal.findFirst({
      where: { id, userId: session!.user!.id! },
      include: {
        tags: { include: { tag: true } },
        milestones: { orderBy: { order: "asc" } },
      },
    }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!goal) notFound();

  const initialData = {
    id: goal.id,
    title: goal.title,
    description: goal.description || "",
    priority: goal.priority,
    targetDate: goal.targetDate ? goal.targetDate.toISOString().split("T")[0] : "",
    categoryId: goal.categoryId || "",
    tags: goal.tags.map((gt: { tag: { name: string } }) => gt.tag.name),
    milestones: goal.milestones.map((m: { title: string }) => m.title),
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Modifica obiettivo</h1>
      <GoalForm categories={categories} initialData={initialData} />
    </div>
  );
}
