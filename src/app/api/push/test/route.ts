import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isFcmReady, sendPush } from "@/lib/push";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const subs = await prisma.pushSubscription.findMany({
    where: { userId: session.user.id },
  });

  if (subs.length === 0)
    return NextResponse.json({ error: "No subscription found — enable notifications first" }, { status: 404 });

  const sent = await sendPush(subs, {
    title: "✅ Goal Tracker",
    body: "Le notifiche funzionano!",
    tag: "test",
  });

  // Distinguere le due sorti aiuta a capire perché una notifica non arriva:
  // "0 su 1 con un token FCM e Firebase non configurato" è una diagnosi,
  // "0 inviate" no.
  const fcmCount = subs.filter((s) => s.kind === "fcm").length;
  return NextResponse.json({
    ok: true,
    sent,
    total: subs.length,
    fcm: fcmCount,
    fcmReady: fcmCount > 0 ? await isFcmReady() : undefined,
  });
}
