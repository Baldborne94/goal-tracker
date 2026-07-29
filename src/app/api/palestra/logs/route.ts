import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { initGymTables } from "@/lib/init-tables";
import { awardStat } from "@/lib/hero-stats-server";

export const runtime = "nodejs";

type RawLogRow = {
  id: string;
  date: string;
  durationMin: number | null;
  notes: string | null;
  createdAt: string;
  exerciseId: string | null;
  setNumber: number | null;
  reps: number | null;
  weight: number | null;
  exerciseName: string | null;
};

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  await initGymTables();

  const { searchParams } = new URL(req.url);
  const dayId = searchParams.get("dayId");
  const limit = parseInt(searchParams.get("limit") ?? "5", 10);

  if (!dayId) return NextResponse.json({ error: "dayId required" }, { status: 400 });

  const rows = await prisma.$queryRawUnsafe<RawLogRow[]>(
    `SELECT gl.id, gl.date, gl."durationMin", gl.notes, gl."createdAt",
       gse."exerciseId", gse."setNumber", gse.reps, gse.weight, ge.name AS "exerciseName"
     FROM "GymLog" gl
     LEFT JOIN "GymSetEntry" gse ON gse."logId" = gl.id
     LEFT JOIN "GymExercise" ge ON ge.id = gse."exerciseId"
     WHERE gl."userId" = $1 AND gl."dayId" = $2
     ORDER BY gl.date DESC, gl."createdAt" DESC
     LIMIT $3`,
    userId, dayId, limit * 20 // fetch extra rows to allow grouping
  );

  // Group by log id
  const logMap = new Map<string, {
    id: string; date: string; durationMin: number | null; notes: string | null;
    entries: { exerciseId: string; exerciseName: string | null; setNumber: number; reps: number | null; weight: number | null }[];
  }>();

  for (const row of rows) {
    if (!logMap.has(row.id)) {
      logMap.set(row.id, {
        id: row.id,
        date: row.date,
        durationMin: row.durationMin,
        notes: row.notes,
        entries: [],
      });
    }
    if (row.exerciseId && row.setNumber !== null) {
      logMap.get(row.id)!.entries.push({
        exerciseId: row.exerciseId,
        exerciseName: row.exerciseName,
        setNumber: row.setNumber,
        reps: row.reps,
        weight: row.weight,
      });
    }
  }

  const logs = Array.from(logMap.values()).slice(0, limit);
  return NextResponse.json({ logs });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  await initGymTables();

  const body = await req.json().catch(() => ({})) as {
    dayId: string;
    date: string;
    durationMin?: number;
    notes?: string;
    entries?: { exerciseId: string; setNumber: number; reps?: number; weight?: number }[];
  };

  const { dayId, date, durationMin, notes, entries } = body;
  if (!dayId || !date) return NextResponse.json({ error: "dayId and date required" }, { status: 400 });

  // Verify day belongs to user
  const dayCheck = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM "GymDay" WHERE id = $1 AND "userId" = $2`,
    dayId, userId
  );
  if (dayCheck.length === 0) return NextResponse.json({ error: "Day not found" }, { status: 404 });

  const logId = `gl_${Math.random().toString(36).slice(2, 11)}`;
  await prisma.$executeRawUnsafe(
    `INSERT INTO "GymLog" ("id","userId","dayId","date","durationMin","notes") VALUES ($1,$2,$3,$4,$5,$6)`,
    logId, userId, dayId, date,
    durationMin !== undefined ? Number(durationMin) : null,
    notes ? String(notes) : null
  );

  // Il ferro nutre la Forza e vale XP quanto una pesata: prima ne dava zero,
  // e sollevare pesi rendeva meno che salire su una bilancia. Una sessione al
  // giorno paga, come per il peso: registrarne dieci non è allenarsi dieci volte.
  const paidToday = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT COUNT(*) as count FROM "GymLog" WHERE "userId" = $1 AND date = $2 AND id <> $3`,
    userId, date, logId
  ).catch(() => [{ count: BigInt(0) }]);

  if (Number(paidToday[0]?.count ?? 0) === 0) {
    await awardStat(userId, "for", 5, "gym_log", "Allenamento in palestra");
    await prisma.user.update({
      where: { id: userId },
      data: { points: { increment: 10 } },
    }).catch(() => {});
  }

  if (entries && entries.length > 0) {
    for (const entry of entries) {
      const entryId = `gse_${Math.random().toString(36).slice(2, 11)}`;
      await prisma.$executeRawUnsafe(
        `INSERT INTO "GymSetEntry" ("id","logId","exerciseId","setNumber","reps","weight") VALUES ($1,$2,$3,$4,$5,$6)`,
        entryId, logId, String(entry.exerciseId), Number(entry.setNumber),
        entry.reps !== undefined ? Number(entry.reps) : null,
        entry.weight !== undefined ? Number(entry.weight) : null
      );
    }
  }

  return NextResponse.json({ logId }, { status: 201 });
}
