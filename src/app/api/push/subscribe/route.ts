import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { initSentReminderTable } from "@/lib/init-tables";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { subscription, timezone } = await req.json();
  const { endpoint, keys } = subscription;

  // Always persist timezone so the cron fires at the right local time
  if (timezone) {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { timezone },
    }).catch(() => {});
  }

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: {
      userId: session.user.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    },
    update: {
      userId: session.user.id,
      p256dh: keys.p256dh,
      auth: keys.auth,
    },
  });

  // Clear today's SentReminder entries so reminders that were skipped
  // due to a wrong timezone fire again on the next cron run.
  await initSentReminderTable();
  const today = new Date().toISOString().slice(0, 10);
  await prisma.$executeRawUnsafe(
    `DELETE FROM "SentReminder" WHERE "userId" = $1 AND "date" = $2`,
    session.user.id, today
  ).catch(() => {});

  return NextResponse.json({ ok: true });
}
