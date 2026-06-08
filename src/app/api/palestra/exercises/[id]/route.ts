import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { initGymTables } from "@/lib/init-tables";

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  await initGymTables();

  const { id } = await params;

  // Verify ownership
  const existing = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM "GymExercise" WHERE id = $1 AND "userId" = $2`,
    id, userId
  );
  if (existing.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const allowed = ["name", "muscleGroup", "sets", "repsMin", "repsMax", "repsNote", "restSec", "weightNote"] as const;

  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIdx = 1;

  for (const key of allowed) {
    if (key in body) {
      const colName = key === "muscleGroup" ? '"muscleGroup"'
        : key === "repsMin" ? '"repsMin"'
        : key === "repsMax" ? '"repsMax"'
        : key === "repsNote" ? '"repsNote"'
        : key === "restSec" ? '"restSec"'
        : key === "weightNote" ? '"weightNote"'
        : `"${key}"`;
      setClauses.push(`${colName} = $${paramIdx}`);
      const val = body[key];
      if (val === null || val === undefined) {
        values.push(null);
      } else if (["sets", "repsMin", "repsMax", "restSec"].includes(key)) {
        values.push(Number(val));
      } else {
        values.push(String(val));
      }
      paramIdx++;
    }
  }

  if (setClauses.length === 0) return NextResponse.json({ error: "No fields to update" }, { status: 400 });

  values.push(id);
  await prisma.$executeRawUnsafe(
    `UPDATE "GymExercise" SET ${setClauses.join(", ")} WHERE id = $${paramIdx}`,
    ...values
  );

  const updated = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT id, "dayId", name, "muscleGroup", sets, "repsMin", "repsMax", "repsNote", "restSec", "weightNote", "order"
     FROM "GymExercise" WHERE id = $1`,
    id
  );

  return NextResponse.json(updated[0]);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  await initGymTables();

  const { id } = await params;

  const existing = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM "GymExercise" WHERE id = $1 AND "userId" = $2`,
    id, userId
  );
  if (existing.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.$executeRawUnsafe(`DELETE FROM "GymExercise" WHERE id = $1`, id);

  return NextResponse.json({ ok: true });
}
