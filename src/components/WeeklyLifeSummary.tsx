import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatDuration } from "@/lib/health";
import { serverDayKey } from "@/lib/utils";

// Riepilogo settimanale della sezione Vita, calcolato sul server insieme al
// resto della dashboard: niente fetch dal client, niente flash di caricamento.
//
// Ogni tile legge dalla fonte vera del suo dato: gli allenamenti sono i log
// della palestra (GymLog), il sonno arriva dal braccialetto via HealthMetric
// — il diario del sonno compilato a mano non esiste più — le abitudini da
// HabitLog e le kcal dal diario alimentare.

function weekStartKey(): string {
  const d = new Date();
  const dow = d.getDay();
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  return serverDayKey(d);
}

export default async function WeeklyLifeSummary({ userId }: { userId: string }) {
  const ws = weekStartKey();
  const today = serverDayKey();

  const [gym, sleep, habitDays, kcalToday] = await Promise.all([
    prisma.$queryRawUnsafe<{ count: bigint; minutes: number | null }[]>(
      `SELECT COUNT(*) as count, SUM(COALESCE("durationMin", 0)) as minutes
       FROM "GymLog" WHERE "userId" = $1 AND date >= $2`,
      userId, ws
    ).catch(() => [{ count: BigInt(0), minutes: 0 }]),
    // Una riga per notte (i campioni della stessa notte si sommano), poi la
    // media fra le sole notti che hanno dati.
    prisma.$queryRawUnsafe<{ avg_minutes: number | null }[]>(
      `SELECT AVG(night.total) as avg_minutes FROM (
         SELECT SUM(value) as total FROM "HealthMetric"
         WHERE "userId" = $1 AND "metricType" = 'sleep' AND date >= $2
         GROUP BY date
       ) night`,
      userId, ws
    ).catch(() => [{ avg_minutes: null }]),
    prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(DISTINCT hl.date) as count
       FROM "HabitLog" hl JOIN "Habit" h ON h.id = hl."habitId"
       WHERE h."userId" = $1 AND hl.date >= $2`,
      userId, ws
    ).catch(() => [{ count: BigInt(0) }]),
    prisma.$queryRawUnsafe<{ kcal: number | null }[]>(
      `SELECT SUM(kcal) as kcal FROM "FoodEntry" WHERE "userId" = $1 AND date = $2`,
      userId, today
    ).catch(() => [{ kcal: null }]),
  ]);

  const gymCount = Number(gym[0]?.count ?? 0);
  const gymMinutes = Math.round(Number(gym[0]?.minutes ?? 0));
  const avgSleepMin = sleep[0]?.avg_minutes != null ? Number(sleep[0].avg_minutes) : null;
  const activeDays = Number(habitDays[0]?.count ?? 0);
  const todayKcal = Math.round(Number(kcalToday[0]?.kcal ?? 0));

  const tiles = [
    gymCount > 0 && {
      href: "/palestra",
      icon: "🏋️",
      value: String(gymCount),
      label: `allenament${gymCount === 1 ? "o" : "i"}${gymMinutes > 0 ? ` · ${gymMinutes} min` : ""}`,
    },
    avgSleepMin != null && {
      href: "/salute",
      icon: "😴",
      value: formatDuration(avgSleepMin),
      label: "media sonno · Fit3",
    },
    activeDays > 0 && {
      href: "/routine",
      icon: "🔁",
      value: String(activeDays),
      label: `giorn${activeDays === 1 ? "o" : "i"} habit attive`,
    },
    todayKcal > 0 && {
      href: "/diet",
      icon: "🥗",
      value: String(todayKcal),
      label: "kcal oggi",
    },
  ].filter((t): t is { href: string; icon: string; value: string; label: string } => Boolean(t));

  if (tiles.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-[#9d8ac7] uppercase tracking-wider">🌿 Riepilogo settimana</h2>
        <Link href="/vita" className="text-sm text-amber-400 font-medium">Vita →</Link>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {tiles.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="rounded-2xl border p-3 text-center block active:scale-95 transition-transform"
            style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}
          >
            <p className="text-xl mb-0.5">{t.icon}</p>
            <p className="text-lg font-bold text-amber-400 tabular-nums">{t.value}</p>
            <p className="text-[10px]" style={{ color: "var(--theme-text-muted)" }}>{t.label}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
