import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user!.id!;

  const [user, goals] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      include: { userRewards: { include: { reward: true } } },
    }),
    prisma.goal.findMany({
      where: { userId },
      include: { category: true, milestones: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const total = await prisma.goal.count({ where: { userId } });
  const completed = await prisma.goal.count({ where: { userId, status: "completed" } });
  const active = total - completed;

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <p className="text-slate-500 text-sm">Ciao,</p>
        <h1 className="text-2xl font-bold text-slate-800">{user?.name || "Utente"} 👋</h1>
      </div>

      {/* Points card */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-5 text-white mb-6">
        <p className="text-indigo-100 text-sm mb-1">I tuoi punti</p>
        <div className="flex items-end gap-2">
          <span className="text-4xl font-bold">{user?.points ?? 0}</span>
          <span className="text-indigo-200 mb-1">pts</span>
        </div>
        <div className="mt-3 flex gap-4 text-sm">
          <div>
            <span className="text-indigo-200">Attivi: </span>
            <span className="font-semibold">{active}</span>
          </div>
          <div>
            <span className="text-indigo-200">Completati: </span>
            <span className="font-semibold">{completed}</span>
          </div>
        </div>
      </div>

      {/* Recent rewards */}
      {user?.userRewards && user.userRewards.length > 0 && (
        <div className="mb-6">
          <h2 className="text-base font-semibold text-slate-700 mb-3">Premi recenti</h2>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {user.userRewards.slice(0, 6).map((ur: { id: string; reward: { icon: string; name: string } }) => (
              <div
                key={ur.id}
                className="flex-shrink-0 bg-white rounded-xl border border-slate-100 px-4 py-3 text-center shadow-sm"
              >
                <div className="text-2xl mb-1">{ur.reward.icon}</div>
                <div className="text-xs font-medium text-slate-700 whitespace-nowrap">
                  {ur.reward.name}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent goals */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-slate-700">Obiettivi recenti</h2>
        <Link href="/goals" className="text-sm text-indigo-600 font-medium">
          Vedi tutti
        </Link>
      </div>

      {goals.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center">
          <div className="text-4xl mb-3">🎯</div>
          <p className="text-slate-500 text-sm mb-4">Nessun obiettivo ancora</p>
          <Link
            href="/goals/new"
            className="inline-block px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold"
          >
            Crea il primo obiettivo
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {goals.map((goal) => {
            const milestonesDone = goal.milestones.filter((m) => m.completed).length;
            const milestonesTotal = goal.milestones.length;

            return (
              <Link
                key={goal.id}
                href={`/goals/${goal.id}`}
                className="block bg-white rounded-2xl border border-slate-100 p-4 shadow-sm hover:border-indigo-200 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-slate-800 line-clamp-1">{goal.title}</h3>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-medium ${
                      goal.status === "completed"
                        ? "bg-green-100 text-green-700"
                        : "bg-indigo-100 text-indigo-700"
                    }`}
                  >
                    {goal.status === "completed" ? "✓ Completato" : "Attivo"}
                  </span>
                </div>

                {goal.category && (
                  <div
                    className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full mb-2"
                    style={{ backgroundColor: goal.category.color + "20", color: goal.category.color }}
                  >
                    {goal.category.name}
                  </div>
                )}

                {/* Progress bar */}
                <div className="mt-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                    <span>
                      {milestonesTotal > 0
                        ? `${milestonesDone}/${milestonesTotal} milestone`
                        : "Progresso"}
                    </span>
                    <span>{goal.progress}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        goal.progress >= 100
                          ? "bg-green-500"
                          : goal.progress >= 50
                          ? "bg-indigo-500"
                          : "bg-indigo-400"
                      }`}
                      style={{ width: `${goal.progress}%` }}
                    />
                  </div>
                </div>

                {goal.targetDate && (
                  <p className="text-xs text-slate-400 mt-2">
                    Scadenza: {formatDate(goal.targetDate)}
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      )}

      {/* FAB */}
      <Link
        href="/goals/new"
        className="fixed bottom-20 right-4 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg flex items-center justify-center text-2xl hover:bg-indigo-700 active:scale-95 transition-all z-40"
      >
        +
      </Link>
    </div>
  );
}
