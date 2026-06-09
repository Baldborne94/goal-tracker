import { prisma } from "./db";

// Tables added after initial schema can't rely solely on build-time seed
// (seed swallows errors on unreachable DB). Run lazy CREATE TABLE IF NOT EXISTS
// once per Lambda warm instance before first write.
let initialized = false;
let svuotaFrigoInitialized = false;
let gymInitialized = false;

export async function initGymTables() {
  if (gymInitialized) return;
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "GymDay" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emoji" TEXT NOT NULL DEFAULT '💪',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GymDay_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "GymDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`);
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "GymExercise" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dayId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "muscleGroup" TEXT NOT NULL,
    "sets" INTEGER NOT NULL DEFAULT 3,
    "repsMin" INTEGER,
    "repsMax" INTEGER,
    "repsNote" TEXT,
    "restSec" INTEGER DEFAULT 60,
    "weightNote" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "GymExercise_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "GymExercise_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "GymDay"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GymExercise_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`);
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "GymLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dayId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "durationMin" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GymLog_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "GymLog_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "GymDay"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GymLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`);
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "GymSetEntry" (
    "id" TEXT NOT NULL,
    "logId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "setNumber" INTEGER NOT NULL,
    "reps" INTEGER,
    "weight" REAL,
    CONSTRAINT "GymSetEntry_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "GymSetEntry_logId_fkey" FOREIGN KEY ("logId") REFERENCES "GymLog"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`);
  gymInitialized = true;
}

export async function initNutrizionistaTables() {
  if (initialized) return;
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "MealCompletion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "meal" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MealCompletion_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MealCompletion_userId_date_meal_key" UNIQUE ("userId","date","meal"),
    CONSTRAINT "MealCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`);
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "ShoppingItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" TEXT,
    "checked" BOOLEAN NOT NULL DEFAULT false,
    "category" TEXT NOT NULL DEFAULT 'altro',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShoppingItem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ShoppingItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`);
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "NutrizionistaDoc" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'application/pdf',
    "data" TEXT NOT NULL,
    "size" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NutrizionistaDoc_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "NutrizionistaDoc_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`);
  initialized = true;
}

export async function initSvuotaFrigoTable() {
  if (svuotaFrigoInitialized) return;
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "SvuotaFrigoRecipe" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ingredients" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SvuotaFrigoRecipe_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SvuotaFrigoRecipe_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`);
  svuotaFrigoInitialized = true;
}
