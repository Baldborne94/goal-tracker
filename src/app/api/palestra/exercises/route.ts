import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { initGymTables } from "@/lib/init-tables";

export const runtime = "nodejs";

type CountRow = { count: bigint };

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  await initGymTables();

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const { dayId, name, muscleGroup, sets, repsMin, repsMax, repsNote, restSec, weightNote } = body;

  if (!dayId || !name || !muscleGroup) {
    return NextResponse.json({ error: "dayId, name, muscleGroup required" }, { status: 400 });
  }

  // Verify day belongs to user
  const dayCheck = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM "GymDay" WHERE id = $1 AND "userId" = $2`,
    String(dayId), userId
  );
  if (dayCheck.length === 0) return NextResponse.json({ error: "Day not found" }, { status: 404 });

  const countRows = await prisma.$queryRawUnsafe<CountRow[]>(
    `SELECT COUNT(*) as count FROM "GymExercise" WHERE "dayId" = $1`,
    String(dayId)
  );
  const order = Number(countRows[0]?.count ?? 0);

  const id = `ge_${Math.random().toString(36).slice(2, 11)}`;
  await prisma.$executeRawUnsafe(
    `INSERT INTO "GymExercise" ("id","userId","dayId","name","muscleGroup","sets","repsMin","repsMax","repsNote","restSec","weightNote","order")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    id, userId, String(dayId), String(name), String(muscleGroup),
    sets ? Number(sets) : 3,
    repsMin ? Number(repsMin) : null,
    repsMax ? Number(repsMax) : null,
    repsNote ? String(repsNote) : null,
    restSec !== undefined ? Number(restSec) : 60,
    weightNote ? String(weightNote) : null,
    order
  );

  return NextResponse.json({
    id, dayId: String(dayId), name: String(name), muscleGroup: String(muscleGroup),
    sets: sets ? Number(sets) : 3,
    repsMin: repsMin ? Number(repsMin) : null,
    repsMax: repsMax ? Number(repsMax) : null,
    repsNote: repsNote ? String(repsNote) : null,
    restSec: restSec !== undefined ? Number(restSec) : 60,
    weightNote: weightNote ? String(weightNote) : null,
    order,
  }, { status: 201 });
}
