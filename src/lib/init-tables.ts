import { prisma } from "./db";

// Tables added after initial schema can't rely solely on build-time seed
// (seed swallows errors on unreachable DB). Run lazy CREATE TABLE IF NOT EXISTS
// once per Lambda warm instance before first write.
let initialized = false;
let svuotaFrigoInitialized = false;
let aiUsageInitialized = false;
let gymInitialized = false;
let sentReminderInitialized = false;
let healthMetricInitialized = false;
let loginTicketInitialized = false;
let mealLogInitialized = false;
let statEventInitialized = false;
let bossInitialized = false;

// Tracks which scheduled reminders have already been delivered today, so an
// external cron running every few minutes never sends a duplicate push.
// Created lazily here because the build-time seed is skipped when the DB is
// unreachable — if this table is missing, the cron's claim() silently fails
// and every reminder gets skipped.
export async function initSentReminderTable() {
  if (sentReminderInitialized) return;
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "SentReminder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SentReminder_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SentReminder_userId_key_date_key" UNIQUE ("userId","key","date"),
    CONSTRAINT "SentReminder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`);
  sentReminderInitialized = true;
}

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

// Lista della spesa. (Un tempo qui nascevano anche le tabelle del piano
// nutrizionista, rimosso: le tabelle fisiche eventualmente presenti nel DB
// restano, ma il codice non le tocca più.)
export async function initSpesaTables() {
  if (initialized) return;
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
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "ShoppingItem" ADD COLUMN IF NOT EXISTS "checkedAt" TIMESTAMP(3)`
  );
  initialized = true;
}

// Note testuali per pasto nella Dieta. La tabella era dichiarata in
// schema.prisma ma non è mai stata creata nel DB (il vecchio ciclo di seed
// abortiva prima di arrivarci): ogni salvataggio delle note falliva in
// silenzio. Da qui in poi nasce al primo uso, come le altre.
export async function initMealLogTable() {
  if (mealLogInitialized) return;
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "MealLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "mealType" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MealLog_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MealLog_userId_date_mealType_key" UNIQUE ("userId","date","mealType"),
    CONSTRAINT "MealLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`);
  mealLogInitialized = true;
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

// Wearable metrics synced from Health Connect. Also adds the two Goal columns
// that let a quest tick itself from those metrics, so the first sync works even
// on a database where the build-time seed never ran.
export async function initHealthMetricTable() {
  if (healthMetricInitialized) return;
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "HealthMetric" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "metricType" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "date" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'health_connect',
    "sourceName" TEXT,
    "dedupKey" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HealthMetric_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "HealthMetric_userId_dedupKey_key" UNIQUE ("userId","dedupKey"),
    CONSTRAINT "HealthMetric_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`);
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "HealthMetric_userId_metricType_date_idx" ON "HealthMetric" ("userId","metricType","date")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "HealthMetric_userId_metricType_recordedAt_idx" ON "HealthMetric" ("userId","metricType","recordedAt")`
  );
  await prisma.$executeRawUnsafe(`ALTER TABLE "Goal" ADD COLUMN IF NOT EXISTS "healthMetric" TEXT`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "Goal" ADD COLUMN IF NOT EXISTS "healthTarget" DOUBLE PRECISION`);
  healthMetricInitialized = true;
}

// Ticket monouso che traghettano la sessione dal browser di sistema alla
// WebView durante il login Google dall'APK (vedi src/lib/login-ticket.ts).
// La chiave è l'hash del ticket, mai il ticket in chiaro.
export async function initLoginTicketTable() {
  if (loginTicketInitialized) return;
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "LoginTicket" (
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LoginTicket_pkey" PRIMARY KEY ("tokenHash"),
    CONSTRAINT "LoginTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`);
  loginTicketInitialized = true;
}

// Registro della Scheda dell'Eroe: ogni riga è un guadagno di punti-stat
// con la sua provenienza («+5 FOR · Allenamento Push»). I totali per stat
// sono SUM su questo registro: niente contatori da tenere allineati.
export async function initStatEventTable() {
  if (statEventInitialized) return;
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "StatEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stat" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StatEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "StatEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`);
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "StatEvent_userId_createdAt_idx" ON "StatEvent" ("userId","createdAt")`
  );
  // Punteggio raggiunto dopo l'evento: se è più alto del precedente, quella
  // riga è il momento in cui la statistica è salita di gradino.
  await prisma.$executeRawUnsafe(`ALTER TABLE "StatEvent" ADD COLUMN IF NOT EXISTS "scoreAfter" INTEGER`);
  statEventInitialized = true;
}

// Boss settimanali abbattuti. Il vincolo di unicità è ciò che impedisce di
// riscuotere due volte la stessa vittoria.
export async function initBossTable() {
  if (bossInitialized) return;
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "BossDefeat" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "week" TEXT NOT NULL,
    "bossId" TEXT NOT NULL,
    "xpAwarded" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BossDefeat_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BossDefeat_userId_week_bossId_key" UNIQUE ("userId","week","bossId"),
    CONSTRAINT "BossDefeat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`);
  bossInitialized = true;
}

export async function initAiUsageTable() {
  if (aiUsageInitialized) return;
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "AiUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiUsage_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AiUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`);
  aiUsageInitialized = true;
}
