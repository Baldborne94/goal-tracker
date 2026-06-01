import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getWebPush } from "@/lib/vapid";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const querySecret = url.searchParams.get("secret");
  const headerSecret = req.headers.get("authorization")?.replace("Bearer ", "");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && querySecret !== cronSecret && headerSecret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const webpush = getWebPush();

  const usersWithGoals = await prisma.user.findMany({
    where: {
      pushSubscriptions: { some: {} },
      goals: { some: { status: "active", reminderTime: { not: null } } },
    },
    select: {
      id: true,
      timezone: true,
      pushSubscriptions: { select: { endpoint: true, p256dh: true, auth: true } },
      goals: {
        where: { status: "active", reminderTime: { not: null } },
        select: { id: true, title: true, reminderTime: true },
      },
    },
  });

  let sent = 0;

  for (const user of usersWithGoals) {
    const now = new Date();
    const userTime = new Intl.DateTimeFormat("en-GB", {
      timeZone: user.timezone || "UTC",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(now);

    const matchingGoals = user.goals.filter(
      (g) => g.reminderTime === userTime
    );

    for (const goal of matchingGoals) {
      for (const sub of user.pushSubscriptions) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify({
              title: `⚔️ Quest reminder: ${goal.title}`,
              body: "Time to work on your quest!",
              tag: `goal-${goal.id}`,
            })
          );
          sent++;
        } catch (err: unknown) {
          if (
            err &&
            typeof err === "object" &&
            "statusCode" in err &&
            (err as { statusCode: number }).statusCode === 410
          ) {
            await prisma.pushSubscription
              .delete({ where: { endpoint: sub.endpoint } })
              .catch(() => {});
          }
        }
      }
    }
  }

  return NextResponse.json({ ok: true, sent, time: new Date().toISOString() });
}
