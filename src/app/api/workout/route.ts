import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

type ExerciseRow = {
  id: string; sessionId: string; name: string; category: string;
  exerciseType: string; sets: number | null; reps: number | null;
  weightKg: number | null; durationMin: number | null;
  met: number | null; kcalBurned: number;
};

type HistoryRow = {
  date: string; sessionId: string; exerciseCount: bigint; kcalBurned: bigint;
};

let tableReady = false;

async function ensureTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "WorkoutSession" (
      id TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      date TEXT NOT NULL,
      "kcalBurned" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "WorkoutSession_pkey" PRIMARY KEY (id),
      CONSTRAINT "WorkoutSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE,
      CONSTRAINT "WorkoutSession_userId_date_key" UNIQUE ("userId", date)
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "WorkoutExercise" (
      id TEXT NOT NULL,
      "sessionId" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Strength',
      "exerciseType" TEXT NOT NULL DEFAULT 'strength',
      sets INTEGER,
      reps INTEGER,
      "weightKg" REAL,
      "durationMin" INTEGER,
      met REAL,
      "kcalBurned" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "WorkoutExercise_pkey" PRIMARY KEY (id),
      CONSTRAINT "WorkoutExercise_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WorkoutSession"(id) ON DELETE CASCADE
    )
  `);
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  if (!tableReady) { await ensureTables().catch(() => {}); tableReady = true; }

  const { searchParams } = new URL(req.url);

  if (searchParams.get("history") === "true") {
    const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const rows = await prisma.$queryRawUnsafe<HistoryRow[]>(
      `SELECT ws.date, ws.id AS "sessionId",
        COUNT(we.id) AS "exerciseCount",
        COALESCE(SUM(we."kcalBurned"), 0) AS "kcalBurned"
       FROM "WorkoutSession" ws
       LEFT JOIN "WorkoutExercise" we ON we."sessionId" = ws.id
       WHERE ws."userId" = $1 AND ws.date >= $2
       GROUP BY ws.date, ws.id
       ORDER BY ws.date DESC`,
      userId, since
    ).catch(() => [] as HistoryRow[]);
    return NextResponse.json(rows.map(r => ({
      date: r.date,
      sessionId: r.sessionId,
      exerciseCount: Number(r.exerciseCount),
      kcalBurned: Number(r.kcalBurned),
    })));
  }

  const date = searchParams.get("date") || new Date().toISOString().slice(0, 10);
  const sessionRows = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM "WorkoutSession" WHERE "userId" = $1 AND date = $2`,
    userId, date
  ).catch(() => [] as { id: string }[]);

  if (sessionRows.length === 0) {
    return NextResponse.json({ exercises: [], kcalBurned: 0, sessionId: null });
  }

  const sessionId = sessionRows[0].id;
  const exercises = await prisma.$queryRawUnsafe<ExerciseRow[]>(
    `SELECT id, "sessionId", name, category, "exerciseType", sets, reps, "weightKg", "durationMin", met, "kcalBurned"
     FROM "WorkoutExercise" WHERE "sessionId" = $1 ORDER BY "createdAt" ASC`,
    sessionId
  ).catch(() => [] as ExerciseRow[]);

  const kcalBurned = exercises.reduce((s, e) => s + e.kcalBurned, 0);
  return NextResponse.json({ exercises, kcalBurned, sessionId });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  if (!tableReady) { await ensureTables().catch(() => {}); tableReady = true; }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const { date, name, exerciseType, category, sets, reps, weightKg, durationMin, met, userWeightKg } = body;

  if (!date || !name || !exerciseType) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const d = String(date);
  const existing = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM "WorkoutSession" WHERE "userId" = $1 AND date = $2`,
    userId, d
  ).catch(() => [] as { id: string }[]);

  let sessionId: string;
  if (existing.length > 0) {
    sessionId = existing[0].id;
  } else {
    sessionId = `ws_${Math.random().toString(36).slice(2, 11)}`;
    await prisma.$executeRawUnsafe(
      `INSERT INTO "WorkoutSession" (id, "userId", date) VALUES ($1, $2, $3)`,
      sessionId, userId, d
    );
  }

  const wt = Number(userWeightKg ?? 70);
  const metVal = Number(met ?? 4.0);
  let kcalBurned = 0;

  if (exerciseType === "cardio" && durationMin) {
    kcalBurned = Math.round(metVal * wt * (Number(durationMin) / 60));
  } else if (exerciseType === "strength" && sets) {
    kcalBurned = Math.round(metVal * wt * (Number(sets) * 2.5 / 60));
  }

  const exerciseId = `we_${Math.random().toString(36).slice(2, 11)}`;
  await prisma.$executeRawUnsafe(
    `INSERT INTO "WorkoutExercise" (id, "sessionId", "userId", name, category, "exerciseType", sets, reps, "weightKg", "durationMin", met, "kcalBurned")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    exerciseId, sessionId, userId,
    String(name), String(category ?? "Strength"), String(exerciseType),
    sets ? Number(sets) : null, reps ? Number(reps) : null,
    weightKg ? Number(weightKg) : null, durationMin ? Number(durationMin) : null,
    metVal, kcalBurned
  );

  await prisma.$executeRawUnsafe(
    `UPDATE "WorkoutSession" SET "kcalBurned" = (SELECT COALESCE(SUM("kcalBurned"),0) FROM "WorkoutExercise" WHERE "sessionId" = $1) WHERE id = $1`,
    sessionId
  );

  return NextResponse.json({
    id: exerciseId, sessionId, name: String(name),
    category: String(category ?? "Strength"), exerciseType: String(exerciseType),
    sets: sets ? Number(sets) : null, reps: reps ? Number(reps) : null,
    weightKg: weightKg ? Number(weightKg) : null, durationMin: durationMin ? Number(durationMin) : null,
    met: metVal, kcalBurned,
  });
}
