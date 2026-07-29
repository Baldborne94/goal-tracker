import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { serverDayKey } from "@/lib/utils";
import { initMealLogTable } from "@/lib/init-tables";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await initMealLogTable();

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") ?? serverDayKey();

  const logs = await prisma.mealLog.findMany({
    where: { userId: session.user.id, date },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(logs);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await initMealLogTable();

  const { date, mealType, text, notes } = await req.json();
  if (!date || !mealType || !text?.trim())
    return NextResponse.json({ error: "date, mealType and text required" }, { status: 400 });

  const log = await prisma.mealLog.upsert({
    where: { userId_date_mealType: { userId: session.user.id, date, mealType } },
    update: { text: text.trim(), notes: notes?.trim() || null, updatedAt: new Date() },
    create: { userId: session.user.id, date, mealType, text: text.trim(), notes: notes?.trim() || null },
  });

  return NextResponse.json(log);
}
