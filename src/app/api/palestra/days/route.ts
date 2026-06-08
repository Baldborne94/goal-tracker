import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { initGymTables } from "@/lib/init-tables";

export const runtime = "nodejs";

type DayRow = { id: string; name: string; emoji: string; order: number };
type ExRow = {
  id: string; dayId: string; name: string; muscleGroup: string;
  sets: number; repsMin: number | null; repsMax: number | null;
  repsNote: string | null; restSec: number | null; weightNote: string | null; order: number;
};
type LastLogRow = { dayId: string; date: string };

const DEFAULT_DAYS = [
  {
    name: "Push",
    emoji: "💪",
    order: 0,
    exercises: [
      { name: "Riscaldamento — Rotazioni spalle + push-up", muscleGroup: "Riscaldamento", sets: 1, repsMin: null, repsMax: null, repsNote: "2 min", restSec: 30, weightNote: null, order: 0 },
      { name: "Panca piana (bilanciere)", muscleGroup: "Petto", sets: 4, repsMin: 10, repsMax: 12, repsNote: null, restSec: 90, weightNote: "~60-80 kg", order: 1 },
      { name: "Distensioni manubri (inclinata)", muscleGroup: "Petto", sets: 3, repsMin: 10, repsMax: 12, repsNote: null, restSec: 75, weightNote: "~14-16 kg", order: 2 },
      { name: "Military press (bilanciere)", muscleGroup: "Spalle", sets: 3, repsMin: 10, repsMax: 12, repsNote: null, restSec: 75, weightNote: "~40-50 kg", order: 3 },
      { name: "Alzate laterali", muscleGroup: "Spalle", sets: 3, repsMin: 12, repsMax: 15, repsNote: null, restSec: 45, weightNote: "~6-8 kg", order: 4 },
      { name: "Dip alle parallele", muscleGroup: "Tricipiti", sets: 3, repsMin: null, repsMax: null, repsNote: "max", restSec: 60, weightNote: null, order: 5 },
      { name: "Pushdown al cavo", muscleGroup: "Tricipiti", sets: 3, repsMin: 12, repsMax: 12, repsNote: null, restSec: 45, weightNote: "~20-30 kg", order: 6 },
    ],
  },
  {
    name: "Pull",
    emoji: "🔙",
    order: 1,
    exercises: [
      { name: "Riscaldamento — Rematori leggeri", muscleGroup: "Riscaldamento", sets: 1, repsMin: null, repsMax: null, repsNote: "2 min", restSec: 30, weightNote: null, order: 0 },
      { name: "Lat pulldown", muscleGroup: "Dorsali", sets: 4, repsMin: 10, repsMax: 12, repsNote: null, restSec: 75, weightNote: "~50-60 kg", order: 1 },
      { name: "Rematore bilanciere", muscleGroup: "Dorsali", sets: 4, repsMin: 10, repsMax: 12, repsNote: null, restSec: 75, weightNote: "~40-60 kg", order: 2 },
      { name: "Seated cable row", muscleGroup: "Dorsali", sets: 3, repsMin: 12, repsMax: 12, repsNote: null, restSec: 60, weightNote: "~40-50 kg", order: 3 },
      { name: "Curl bilanciere", muscleGroup: "Bicipiti", sets: 3, repsMin: 12, repsMax: 15, repsNote: null, restSec: 60, weightNote: "~20-30 kg", order: 4 },
      { name: "Hammer curl (manubri)", muscleGroup: "Bicipiti", sets: 3, repsMin: 12, repsMax: 12, repsNote: null, restSec: 45, weightNote: "~8-12 kg", order: 5 },
      { name: "Concentration curl", muscleGroup: "Bicipiti", sets: 2, repsMin: 12, repsMax: 12, repsNote: null, restSec: 45, weightNote: "~6-8 kg", order: 6 },
    ],
  },
  {
    name: "Gambe",
    emoji: "🦵",
    order: 2,
    exercises: [
      { name: "Riscaldamento — Jumping jacks + squat corpo libero", muscleGroup: "Riscaldamento", sets: 1, repsMin: null, repsMax: null, repsNote: "2 min", restSec: 30, weightNote: null, order: 0 },
      { name: "Squat bilanciere", muscleGroup: "Quadricipiti/Glutei", sets: 4, repsMin: 10, repsMax: 12, repsNote: null, restSec: 90, weightNote: "~60-80 kg", order: 1 },
      { name: "Bulgarian split squat", muscleGroup: "Quadricipiti/Glutei", sets: 3, repsMin: null, repsMax: null, repsNote: "10/gamba", restSec: 75, weightNote: "~10-12 kg", order: 2 },
      { name: "Stacco rumeno (bilanciere)", muscleGroup: "Femorali/Glutei", sets: 4, repsMin: 12, repsMax: 12, repsNote: null, restSec: 90, weightNote: "~50-70 kg", order: 3 },
      { name: "Leg press", muscleGroup: "Quadricipiti/Glutei", sets: 3, repsMin: 12, repsMax: 15, repsNote: null, restSec: 75, weightNote: "~80-120 kg", order: 4 },
      { name: "Hip thrust (smith machine)", muscleGroup: "Femorali/Glutei", sets: 3, repsMin: 15, repsMax: 20, repsNote: null, restSec: 60, weightNote: "~40-60 kg", order: 5 },
      { name: "Leg curl", muscleGroup: "Femorali", sets: 3, repsMin: 12, repsMax: 12, repsNote: null, restSec: 60, weightNote: null, order: 6 },
    ],
  },
  {
    name: "Addome + Cardio",
    emoji: "🔥",
    order: 3,
    exercises: [
      { name: "Leg raise (captain's chair)", muscleGroup: "Addome", sets: 3, repsMin: 15, repsMax: 15, repsNote: null, restSec: 45, weightNote: null, order: 0 },
      { name: "Side plank", muscleGroup: "Addome", sets: 3, repsMin: null, repsMax: null, repsNote: "30 sec/lato", restSec: 45, weightNote: null, order: 1 },
      { name: "Hollow hold", muscleGroup: "Addome", sets: 3, repsMin: null, repsMax: null, repsNote: "30 sec", restSec: 45, weightNote: null, order: 2 },
      { name: "Burpees", muscleGroup: "Cardio", sets: 3, repsMin: 10, repsMax: 12, repsNote: null, restSec: 60, weightNote: null, order: 3 },
      { name: "HIIT tapis roulant", muscleGroup: "Cardio", sets: 1, repsMin: null, repsMax: null, repsNote: "10 min (30\"/30\")", restSec: 0, weightNote: null, order: 4 },
    ],
  },
];

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  await initGymTables();

  // Check if user already has days
  const existing = await prisma.$queryRawUnsafe<DayRow[]>(
    `SELECT id, name, emoji, "order" FROM "GymDay" WHERE "userId" = $1 ORDER BY "order" ASC`,
    userId
  );

  if (existing.length === 0) {
    // Seed default days and exercises
    for (const day of DEFAULT_DAYS) {
      const dayId = `gd_${Math.random().toString(36).slice(2, 11)}`;
      await prisma.$executeRawUnsafe(
        `INSERT INTO "GymDay" ("id","userId","name","emoji","order") VALUES ($1,$2,$3,$4,$5)`,
        dayId, userId, day.name, day.emoji, day.order
      );
      for (const ex of day.exercises) {
        const exId = `ge_${Math.random().toString(36).slice(2, 11)}`;
        await prisma.$executeRawUnsafe(
          `INSERT INTO "GymExercise" ("id","userId","dayId","name","muscleGroup","sets","repsMin","repsMax","repsNote","restSec","weightNote","order")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          exId, userId, dayId, ex.name, ex.muscleGroup, ex.sets,
          ex.repsMin, ex.repsMax, ex.repsNote, ex.restSec, ex.weightNote, ex.order
        );
      }
    }
  }

  // Re-fetch days
  const days = await prisma.$queryRawUnsafe<DayRow[]>(
    `SELECT id, name, emoji, "order" FROM "GymDay" WHERE "userId" = $1 ORDER BY "order" ASC`,
    userId
  );

  const exercises = await prisma.$queryRawUnsafe<ExRow[]>(
    `SELECT id, "dayId", name, "muscleGroup", sets, "repsMin", "repsMax", "repsNote", "restSec", "weightNote", "order"
     FROM "GymExercise" WHERE "userId" = $1 ORDER BY "order" ASC`,
    userId
  );

  const lastLogs = await prisma.$queryRawUnsafe<LastLogRow[]>(
    `SELECT DISTINCT ON ("dayId") "dayId", date FROM "GymLog" WHERE "userId" = $1 ORDER BY "dayId", date DESC`,
    userId
  );

  const lastLogMap: Record<string, string> = {};
  for (const l of lastLogs) lastLogMap[l.dayId] = l.date;

  const result = days.map((d) => ({
    id: d.id,
    name: d.name,
    emoji: d.emoji,
    order: d.order,
    exercises: exercises
      .filter((e) => e.dayId === d.id)
      .map((e) => ({
        id: e.id,
        name: e.name,
        muscleGroup: e.muscleGroup,
        sets: e.sets,
        repsMin: e.repsMin,
        repsMax: e.repsMax,
        repsNote: e.repsNote,
        restSec: e.restSec,
        weightNote: e.weightNote,
        order: e.order,
      })),
    lastLogDate: lastLogMap[d.id] ?? null,
  }));

  return NextResponse.json({ days: result });
}
