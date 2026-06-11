import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

// Debug endpoint: shows current push state for the logged-in user.
// Useful for diagnosing why reminders aren't arriving.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;

  const [userRows, goals, subs, sentToday] = await Promise.all([
    prisma.$queryRawUnsafe<{ timezone: string; reminderEnabled: boolean; reminderTime: string }[]>(
      `SELECT timezone, "reminderEnabled", "reminderTime" FROM "User" WHERE id = $1`, userId
    ),
    prisma.$queryRawUnsafe<{ id: string; title: string; status: string; reminderTime: string | null; reminderFrequency: string | null }[]>(
      `SELECT id, title, status, "reminderTime", "reminderFrequency" FROM "Goal" WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT 20`, userId
    ),
    prisma.$queryRawUnsafe<{ endpoint: string; createdAt: string }[]>(
      `SELECT endpoint, "createdAt" FROM "PushSubscription" WHERE "userId" = $1`, userId
    ),
    prisma.$queryRawUnsafe<{ key: string; date: string; createdAt: string }[]>(
      `SELECT key, date, "createdAt" FROM "SentReminder" WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT 20`, userId
    ),
  ]);

  const tz = userRows[0]?.timezone ?? "UTC";
  const now = new Date();
  const userTime = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(now);
  const todayLocal = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(now);

  return NextResponse.json({
    now: now.toISOString(),
    userLocalTime: userTime,
    todayLocal,
    timezone: tz,
    pushSubscriptions: subs.map(s => ({
      endpointSuffix: s.endpoint.slice(-30),
      createdAt: s.createdAt,
    })),
    goals: goals.map(g => ({
      id: g.id,
      title: g.title,
      status: g.status,
      reminderTime: g.reminderTime,
      reminderFrequency: g.reminderFrequency,
      claimedToday: sentToday.some(s => s.key === `goal-${g.id}` && s.date === todayLocal),
    })),
    sentToday: sentToday.filter(s => s.date === todayLocal),
  });
}
