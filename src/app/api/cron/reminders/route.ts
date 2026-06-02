import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getWebPush } from "@/lib/vapid";

export const runtime = "nodejs";

async function sendPush(
  webpush: ReturnType<typeof getWebPush>,
  subs: { endpoint: string; p256dh: string; auth: string }[],
  payload: { title: string; body: string; tag: string }
) {
  let sent = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      );
      sent++;
    } catch (err: unknown) {
      if (err && typeof err === "object" && "statusCode" in err && (err as { statusCode: number }).statusCode === 410) {
        await prisma.pushSubscription.delete({ where: { endpoint: sub.endpoint } }).catch(() => {});
      }
    }
  }
  return sent;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const querySecret = url.searchParams.get("secret");
  const headerSecret = req.headers.get("authorization")?.replace("Bearer ", "");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && querySecret !== cronSecret && headerSecret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const webpush = getWebPush();

  const users = await prisma.user.findMany({
    where: { pushSubscriptions: { some: {} } },
    select: {
      id: true,
      timezone: true,
      pushSubscriptions: { select: { endpoint: true, p256dh: true, auth: true } },
      goals: {
        where: { status: "active" },
        select: { id: true, title: true, reminderTime: true, reminderFrequency: true, reminderDay: true, targetDate: true },
      },
    },
  });

  let sent = 0;

  for (const user of users) {
    const tz = user.timezone || "UTC";
    const now = new Date();

    const userTime = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(now);

    const todayLocal = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(now);
    const dayOfWeek = new Date(now.toLocaleString("en-US", { timeZone: tz })).getDay(); // 0=Sun
    const dayOfMonth = parseInt(todayLocal.split("-")[2]);

    // Reminder notifications (daily / weekly / monthly)
    for (const goal of user.goals.filter((g) => g.reminderTime === userTime)) {
      const freq = goal.reminderFrequency ?? "daily";
      const shouldFire =
        freq === "daily" ||
        (freq === "weekly" && goal.reminderDay === dayOfWeek) ||
        (freq === "monthly" && goal.reminderDay === dayOfMonth);

      if (!shouldFire) continue;

      const freqLabel = freq === "weekly" ? "weekly" : freq === "monthly" ? "monthly" : "daily";
      sent += await sendPush(webpush, user.pushSubscriptions, {
        title: `⚔️ Quest reminder: ${goal.title}`,
        body: `Your ${freqLabel} reminder — time to work on your quest!`,
        tag: `goal-${goal.id}`,
      });
    }

    // Deadline warning: fire once when the user's local time is 09:00 and deadline is in 3 days
    if (userTime === "09:00") {
      const [y, mo, d] = todayLocal.split("-").map(Number);
      const deadlineDate = new Date(y, mo - 1, d + 3);
      const deadlineStr = `${deadlineDate.getFullYear()}-${String(deadlineDate.getMonth() + 1).padStart(2, "0")}-${String(deadlineDate.getDate()).padStart(2, "0")}`;

      for (const goal of user.goals.filter((g) => g.targetDate)) {
        const goalDate = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date(goal.targetDate!));
        if (goalDate === deadlineStr) {
          sent += await sendPush(webpush, user.pushSubscriptions, {
            title: `⏰ Quest expires in 3 days: ${goal.title}`,
            body: "You have 3 days left. Push through!",
            tag: `deadline-${goal.id}`,
          });
        }
      }
    }
  }

  return NextResponse.json({ ok: true, sent, time: new Date().toISOString() });
}
