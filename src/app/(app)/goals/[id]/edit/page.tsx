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

  const g = goal as typeof goal & {
    reminderTime?: string | null;
    reminderFrequency?: string | null;
    reminderDay?: number | null;
    reminderDays?: string | null;
    isRecurring?: boolean;
    recurrenceType?: string | null;
    dailyCheckIn?: boolean;
    checkInXP?: number;
    checkInDays?: string | null;
    healthMetric?: string | null;
    healthTarget?: number | null;
  };

  const initialData = {
    id: goal.id,
    title: goal.title,
    description: goal.description || "",
    priority: goal.priority,
    targetDate: goal.targetDate ? goal.targetDate.toISOString().split("T")[0] : "",
    categoryId: goal.categoryId || "",
    reminderTime: g.reminderTime || "",
    reminderFrequency: g.reminderFrequency || "daily",
    reminderDay: g.reminderDay ?? undefined,
    reminderDays: g.reminderDays ?? null,
    isRecurring: g.isRecurring ?? false,
    recurrenceType: g.recurrenceType ?? null,
    dailyCheckIn: g.dailyCheckIn ?? false,
    checkInXP: g.checkInXP ?? 5,
    checkInDays: g.checkInDays ?? null,
    healthMetric: g.healthMetric ?? null,
    healthTarget: g.healthTarget ?? null,
    tags: goal.tags.map((gt: { tag: { name: string } }) => gt.tag.name),
    milestones: goal.milestones.map((m: { id: string; title: string; completed: boolean }) => ({
      id: m.id,
      title: m.title,
      completed: m.completed,
    })),
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-white mb-6">✏️ Edit quest</h1>
      <GoalForm categories={categories} initialData={initialData} />
    </div>
  );
}
