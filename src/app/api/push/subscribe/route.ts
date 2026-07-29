import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { initSentReminderTable } from "@/lib/init-tables";
import { dayKey } from "@/lib/utils";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { subscription, fcmToken, timezone } = await req.json();

  // Always persist timezone so the cron fires at the right local time
  if (timezone) {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { timezone },
    }).catch(() => {});
  }

  // Dall'APK arriva un token FCM, dal browser una subscription Web Push. Le
  // due convivono: chi usa entrambi riceve su entrambi, ed è giusto così.
  if (typeof fcmToken === "string" && fcmToken.length > 0) {
    await prisma.pushSubscription.upsert({
      where: { endpoint: fcmToken },
      create: { userId: session.user.id, kind: "fcm", endpoint: fcmToken, p256dh: null, auth: null },
      update: { userId: session.user.id, kind: "fcm" },
    });
    return NextResponse.json({ ok: true, kind: "fcm" });
  }

  if (!subscription?.endpoint || !subscription?.keys) {
    return NextResponse.json({ error: "Serve una subscription o un token FCM" }, { status: 400 });
  }

  const { endpoint, keys } = subscription;

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: {
      userId: session.user.id,
      kind: "web",
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
  // Il cron scrive SentReminder con la data nel fuso dell'utente: qui va
  // usato lo stesso, altrimenti la pulizia manca il bersaglio di due ore.
  const today = dayKey(new Date(), timezone || "UTC");
  await prisma.$executeRawUnsafe(
    `DELETE FROM "SentReminder" WHERE "userId" = $1 AND "date" = $2`,
    session.user.id, today
  ).catch(() => {});

  return NextResponse.json({ ok: true });
}
