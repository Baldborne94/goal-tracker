import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import GoalForm from "@/components/goals/GoalForm";

export default async function NewGoalPage({
  searchParams,
}: {
  searchParams: Promise<{ title?: string }>;
}) {
  await auth();
  const [categories, { title }] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    searchParams,
  ]);

  const prefill = title
    ? { title, description: "", priority: "medium", targetDate: "", categoryId: "", tags: [], milestones: [] }
    : undefined;

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-[#ede9ff] mb-6">🗡️ Nuova missione</h1>
      <GoalForm categories={categories} initialData={prefill} />
    </div>
  );
}
