import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const goals = await prisma.goal.findMany({
    where: { userId: session.user.id },
    include: {
      category: true,
      milestones: { orderBy: { order: "asc" } },
      tags: { include: { tag: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(goals);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const body = await req.json();
  const { title, description, priority, targetDate, categoryId, tags, milestones } = body;

  if (!title)
    return NextResponse.json({ error: "Titolo obbligatorio" }, { status: 400 });

  const goal = await prisma.goal.create({
    data: {
      title,
      description,
      priority: priority || "medium",
      targetDate: targetDate ? new Date(targetDate) : null,
      categoryId: categoryId || null,
      userId: session.user.id,
      tags: tags?.length
        ? {
            create: tags.map((tagName: string) => ({
              tag: {
                connectOrCreate: {
                  where: { name: tagName },
                  create: { name: tagName },
                },
              },
            })),
          }
        : undefined,
      milestones: milestones?.length
        ? {
            create: milestones.map((m: string, i: number) => ({
              title: m,
              order: i,
            })),
          }
        : undefined,
    },
    include: {
      category: true,
      milestones: true,
      tags: { include: { tag: true } },
    },
  });

  return NextResponse.json(goal, { status: 201 });
}
