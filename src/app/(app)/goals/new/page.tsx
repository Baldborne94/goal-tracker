import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import GoalForm from "@/components/goals/GoalForm";

function fmt(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function generateMilestones(
  mtype: string,
  durationDays: number,
  today: Date,
  spw?: number
): string[] {
  if (mtype === "daily") {
    return Array.from({ length: durationDays }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      return `Day ${i + 1} · ${fmt(d)}`;
    });
  }
  if (mtype === "sessions" && spw) {
    const weeks = Math.ceil(durationDays / 7);
    const total = weeks * spw;
    return Array.from({ length: total }, (_, i) => {
      const week = Math.floor(i / spw) + 1;
      const session = (i % spw) + 1;
      return `Week ${week} · Session ${session}`;
    });
  }
  if (mtype === "weekly") {
    const weeks = Math.ceil(durationDays / 7);
    return Array.from({ length: weeks }, (_, i) => {
      const start = new Date(today);
      start.setDate(start.getDate() + i * 7);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return `Week ${i + 1} · ${fmt(start)} – ${fmt(end)}`;
    });
  }
  return [];
}

function getDeadline(today: Date, durationDays: number): string {
  const d = new Date(today);
  d.setDate(d.getDate() + durationDays - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function NewGoalPage({
  searchParams,
}: {
  searchParams: Promise<{ title?: string; days?: string; mtype?: string; spw?: string; template?: string }>;
}) {
  await auth();
  const [categories, params] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    searchParams,
  ]);

  const { title, days, mtype, spw, template } = params;
  const today = new Date();
  let prefill: { title: string; description: string; priority: string; targetDate: string; categoryId: string; tags: string[]; milestones: string[] } | undefined;

  if (template) {
    try {
      const data = JSON.parse(Buffer.from(template, "base64").toString("utf-8"));
      prefill = {
        title: data.title ?? "",
        description: data.description ?? "",
        priority: data.priority ?? "medium",
        targetDate: "",
        categoryId: "",
        tags: [],
        milestones: Array.isArray(data.milestones) ? data.milestones : [],
      };
    } catch {
      // invalid template — ignore
    }
  }

  if (!prefill && title) {
    const durationDays = days ? parseInt(days, 10) : 0;
    const sessionsPerWeek = spw ? parseInt(spw, 10) : undefined;
    const milestones =
      mtype && durationDays > 0
        ? generateMilestones(mtype, durationDays, today, sessionsPerWeek)
        : [];
    const targetDate = durationDays > 0 ? getDeadline(today, durationDays) : "";
    prefill = { title, description: "", priority: "medium", targetDate, categoryId: "", tags: [], milestones };
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-[#ede9ff] mb-6">🗡️ Nuova missione</h1>
      <GoalForm categories={categories} initialData={prefill} />
    </div>
  );
}
