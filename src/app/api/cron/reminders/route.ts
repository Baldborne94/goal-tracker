import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getWebPush } from "@/lib/vapid";

export const runtime = "nodejs";

// How many minutes after a reminder's scheduled time we'll still deliver it.
// GitHub Actions free-tier cron can be delayed 15-30+ min under load.
// Combined with per-day dedup, a reminder fires exactly once per day.
const WINDOW_MINUTES = 30;

function minutesOfDay(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

// Returns true the first time a given reminder key is claimed for `date`.
// Backed by a UNIQUE(userId, key, date) constraint so concurrent/overlapping
// cron runs can never both win — the second INSERT hits ON CONFLICT and the
// affected-row count comes back as 0.
async function claim(userId: string, key: string, date: string) {
  const id = `sr_${Math.random().toString(36).slice(2, 11)}`;
  const inserted = await prisma.$executeRawUnsafe(
    `INSERT INTO "SentReminder" ("id","userId","key","date") VALUES ($1,$2,$3,$4)
     ON CONFLICT ("userId","key","date") DO NOTHING`,
    id, userId, key, date
  ).catch(() => 0);
  return inserted === 1;
}

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
      const status = err && typeof err === "object" && "statusCode" in err ? (err as { statusCode: number }).statusCode : 0;
      console.error(`[push] send failed endpoint=${sub.endpoint.slice(-20)} status=${status}`, err);
      if (status === 410) {
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
        select: { id: true, title: true, reminderTime: true, reminderFrequency: true, reminderDay: true, reminderDays: true, targetDate: true },
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
    const nowMin = minutesOfDay(userTime);

    const todayLocal = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(now);
    const dayOfWeek = new Date(now.toLocaleString("en-US", { timeZone: tz })).getDay();
    const dayOfMonth = parseInt(todayLocal.split("-")[2]);

    // True when `scheduled` (HH:MM local) falls inside the delivery window ending now.
    const inWindow = (scheduled: string) => {
      const diff = nowMin - minutesOfDay(scheduled);
      return diff >= 0 && diff < WINDOW_MINUTES;
    };

    // Reminder notifications (daily / weekly / monthly / custom)
    for (const goal of user.goals.filter((g) => g.reminderTime && inWindow(g.reminderTime))) {
      const freq = goal.reminderFrequency ?? "daily";
      const customDays = goal.reminderDays ? goal.reminderDays.split(",").map(Number) : [];
      const shouldFire =
        freq === "daily" ||
        (freq === "weekly" && goal.reminderDay === dayOfWeek) ||
        (freq === "monthly" && goal.reminderDay === dayOfMonth) ||
        (freq === "custom" && customDays.includes(dayOfWeek));

      if (!shouldFire) continue;
      const claimed = await claim(user.id, `goal-${goal.id}`, todayLocal);
      console.log(`[cron/reminders] goal=${goal.id} title="${goal.title}" time=${goal.reminderTime} tz=${tz} userTime=${userTime} inWindow=${inWindow(goal.reminderTime!)} claimed=${claimed}`);
      if (!claimed) continue;

      const freqLabel = freq === "weekly" ? "weekly" : freq === "monthly" ? "monthly" : "daily";
      sent += await sendPush(webpush, user.pushSubscriptions, {
        title: `⚔️ Quest reminder: ${goal.title}`,
        body: `Your ${freqLabel} reminder — time to work on your quest!`,
        tag: `goal-${goal.id}`,
      });
    }

    // Deadline warnings + bills + monthly upkeep, delivered in the window after 09:00 local time
    if (inWindow("09:00")) {
      const [y, mo, d] = todayLocal.split("-").map(Number);

      for (const daysLeft of [7, 3, 1]) {
        const targetDate = new Date(y, mo - 1, d + daysLeft);
        const targetStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, "0")}-${String(targetDate.getDate()).padStart(2, "0")}`;

        for (const goal of user.goals.filter((g) => g.targetDate)) {
          const goalDate = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date(goal.targetDate!));
          if (goalDate === targetStr) {
            if (!(await claim(user.id, `deadline-${daysLeft}d-${goal.id}`, todayLocal))) continue;
            sent += await sendPush(webpush, user.pushSubscriptions, {
              title: `⏰ Quest expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}: ${goal.title}`,
              body: daysLeft === 1 ? "Last chance — finish strong today!" : `Only ${daysLeft} days left. Push through!`,
              tag: `deadline-${daysLeft}d-${goal.id}`,
            });
          }
        }
      }

      // Bill payment reminders
      {
        const bills = await prisma.$queryRawUnsafe<{
          id: string; title: string; amount: number; dueDay: number; notifyDaysBefore: number;
        }[]>(
          `SELECT id, title, amount, "dueDay", "notifyDaysBefore" FROM "RecurringBill" WHERE "userId" = $1 AND active = true`,
          user.id
        ).catch(() => []);

        const daysInMonth = new Date(y, mo, 0).getDate();
        for (const bill of bills) {
          const daysUntilDue = bill.dueDay >= dayOfMonth
            ? bill.dueDay - dayOfMonth
            : (daysInMonth - dayOfMonth) + bill.dueDay;
          if (daysUntilDue === bill.notifyDaysBefore) {
            if (!(await claim(user.id, `bill-${bill.id}-${todayLocal.slice(0, 7)}`, todayLocal))) continue;
            const suffix = bill.dueDay === 1 ? "st" : bill.dueDay === 2 ? "nd" : bill.dueDay === 3 ? "rd" : "th";
            sent += await sendPush(webpush, user.pushSubscriptions, {
              title: `💳 Payment in ${bill.notifyDaysBefore} day${bill.notifyDaysBefore === 1 ? "" : "s"}: ${bill.title}`,
              body: `€${bill.amount.toFixed(2)} due on the ${bill.dueDay}${suffix} — make sure funds are ready!`,
              tag: `bill-${bill.id}-${todayLocal.slice(0, 7)}`,
            });
          }
        }
      }

      // On the 1st of each month at 09:00 local time: create recurring expenses
      if (dayOfMonth === 1) {
        const prevMonth = new Date(y, mo - 2, 1);
        const prevMonthStr = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}`;
        const currMonthStr = `${y}-${String(mo).padStart(2, "0")}`;

        const recurringExpenses = await prisma.$queryRawUnsafe<{
          id: string; amount: number; category: string; description: string | null; merchant: string | null;
        }[]>(
          `SELECT id, amount, category, description, merchant FROM "Expense"
           WHERE "userId" = $1 AND "isRecurring" = true
           AND date >= $2::timestamp AND date < $3::timestamp`,
          user.id,
          `${prevMonthStr}-01`,
          `${currMonthStr}-01`
        );

        for (const exp of recurringExpenses) {
          const existsThisMonth = await prisma.$queryRawUnsafe<{ id: string }[]>(
            `SELECT id FROM "Expense" WHERE "userId" = $1 AND "category" = $2 AND "isRecurring" = true
             AND date >= $3::timestamp AND date < $4::timestamp LIMIT 1`,
            user.id, exp.category, `${currMonthStr}-01`,
            `${y}-${String(mo + 1).padStart(2, "0")}-01`
          );
          if (existsThisMonth.length === 0) {
            const newId = `exp_${Math.random().toString(36).slice(2, 11)}`;
            await prisma.$executeRawUnsafe(
              `INSERT INTO "Expense" ("id","userId","amount","category","description","merchant","date","createdAt","isRecurring")
               VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW(),true)`,
              newId, user.id, exp.amount, exp.category, exp.description, exp.merchant
            );
          }
        }
      }
    }
  }

  console.log(`[cron/reminders] done users=${users.length} sent=${sent} time=${new Date().toISOString()}`);
  return NextResponse.json({ ok: true, sent, users: users.length, time: new Date().toISOString() });
}
