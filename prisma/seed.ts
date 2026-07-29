import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

const DEFAULT_CATEGORIES = [
  { name: "Health", color: "#22c55e", icon: "heart" },
  { name: "Work", color: "#3b82f6", icon: "briefcase" },
  { name: "Learning", color: "#a855f7", icon: "book-open" },
  { name: "Finance", color: "#f59e0b", icon: "piggy-bank" },
  { name: "Personal", color: "#ec4899", icon: "star" },
  { name: "Hobby", color: "#f97316", icon: "gamepad-2" },
];

const DAILY_CHALLENGES = [
  { title: "Early Bird",    description: "Complete at least 1 milestone today",    xp: 15, type: "complete_milestone" },
  { title: "Budget Tracker",description: "Log at least 1 expense today",           xp: 10, type: "log_expense" },
  { title: "Check-in Hero", description: "Do a daily check-in on any quest today", xp: 15, type: "daily_checkin" },
  { title: "Momentum",      description: "Complete 3 milestones today",            xp: 20, type: "complete_3_milestones" },
  { title: "Quest Closer",  description: "Mark a quest as complete today",         xp: 25, type: "complete_quest" },
];

// Applies schema changes that can't go through prisma db push on pooled connections.
// All statements are idempotent (ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS).
const MIGRATIONS = [
  `ALTER TABLE "Goal" ADD COLUMN IF NOT EXISTS "reminderFrequency" TEXT`,
  `ALTER TABLE "Goal" ADD COLUMN IF NOT EXISTS "reminderDay" INTEGER`,
  `ALTER TABLE "Goal" ADD COLUMN IF NOT EXISTS "reminderDays" TEXT`,
  `ALTER TABLE "Goal" ADD COLUMN IF NOT EXISTS "isRecurring" BOOLEAN DEFAULT false`,
  `ALTER TABLE "Goal" ADD COLUMN IF NOT EXISTS "recurrenceType" TEXT`,
  `ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "isRecurring" BOOLEAN DEFAULT false`,
  `CREATE TABLE IF NOT EXISTS "CategoryBudget" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    CONSTRAINT "CategoryBudget_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CategoryBudget_userId_month_category_key" UNIQUE ("userId", "month", "category"),
    CONSTRAINT "CategoryBudget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "DailyChallenge" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 10,
    "type" TEXT NOT NULL,
    CONSTRAINT "DailyChallenge_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "UserDailyChallenge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "UserDailyChallenge_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "UserDailyChallenge_userId_challengeId_date_key" UNIQUE ("userId", "challengeId", "date"),
    CONSTRAINT "UserDailyChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserDailyChallenge_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "DailyChallenge"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `ALTER TABLE "Goal" ADD COLUMN IF NOT EXISTS "dailyCheckIn" BOOLEAN DEFAULT false`,
  `ALTER TABLE "Goal" ADD COLUMN IF NOT EXISTS "checkInXP" INTEGER DEFAULT 5`,
  `ALTER TABLE "Goal" ADD COLUMN IF NOT EXISTS "checkInDays" TEXT`,
  `CREATE TABLE IF NOT EXISTS "QuestCheckIn" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "note" TEXT,
    "xpAwarded" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuestCheckIn_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "QuestCheckIn_goalId_userId_date_key" UNIQUE ("goalId", "userId", "date"),
    CONSTRAINT "QuestCheckIn_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuestCheckIn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  // Enable Row Level Security on all tables (blocks public Supabase REST API access; service_role bypasses RLS)
  `ALTER TABLE "User" ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE "Goal" ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE "Milestone" ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE "Account" ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE "Category" ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE "Tag" ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE "GoalTag" ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE "Reward" ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE "UserReward" ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE "MonthlyBudget" ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE "CategoryBudget" ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE "Expense" ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE "WeightEntry" ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE "Habit" ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE "HabitLog" ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE "MealLog" ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE "PushSubscription" ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE "DailyChallenge" ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE "UserDailyChallenge" ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE "QuestCheckIn" ENABLE ROW LEVEL SECURITY`,
  // Remove Alchemy-dependent challenges that can never be completed
  `DELETE FROM "DailyChallenge" WHERE "type" IN ('check_habit', 'log_weight', 'log_meal')`,
  // Onboarding flag for new users (existing users get false and will see the tutorial once)
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "onboardingComplete" BOOLEAN NOT NULL DEFAULT false`,
  // Hero class chosen during onboarding (nullable = not yet chosen)
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "heroClass" TEXT`,
  // Recurring bills with push notification reminders
  `CREATE TABLE IF NOT EXISTS "RecurringBill" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "dueDay" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "notifyDaysBefore" INTEGER NOT NULL DEFAULT 3,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecurringBill_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RecurringBill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `ALTER TABLE "RecurringBill" ENABLE ROW LEVEL SECURITY`,
  `CREATE TABLE IF NOT EXISTS "FoodEntry" (
    id TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    date TEXT NOT NULL,
    "mealType" TEXT NOT NULL,
    "foodName" TEXT NOT NULL,
    grams REAL NOT NULL,
    "kcalPer100g" REAL NOT NULL,
    kcal REAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FoodEntry_pkey" PRIMARY KEY (id),
    CONSTRAINT "FoodEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "ShoppingItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" TEXT,
    "checked" BOOLEAN NOT NULL DEFAULT false,
    "category" TEXT NOT NULL DEFAULT 'altro',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShoppingItem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ShoppingItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `ALTER TABLE "ShoppingItem" ENABLE ROW LEVEL SECURITY`,
  // Tracks which scheduled reminders have already been sent today, so an
  // external cron that runs every few minutes never delivers a duplicate push.
  `CREATE TABLE IF NOT EXISTS "SentReminder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SentReminder_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SentReminder_userId_key_date_key" UNIQUE ("userId","key","date"),
    CONSTRAINT "SentReminder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `ALTER TABLE "SentReminder" ENABLE ROW LEVEL SECURITY`,
  // Salute — wearable metrics read from Health Connect (Galaxy Fit3 → Samsung
  // Health → Health Connect). Generic on purpose: a new metric type is a new
  // row, not a new column. "dedupKey" is what makes re-reading the same day
  // idempotent.
  `CREATE TABLE IF NOT EXISTS "HealthMetric" (
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
  )`,
  `CREATE INDEX IF NOT EXISTS "HealthMetric_userId_metricType_date_idx" ON "HealthMetric" ("userId","metricType","date")`,
  `CREATE INDEX IF NOT EXISTS "HealthMetric_userId_metricType_recordedAt_idx" ON "HealthMetric" ("userId","metricType","recordedAt")`,
  `ALTER TABLE "HealthMetric" ENABLE ROW LEVEL SECURITY`,
  // Lets a quest auto-complete its daily check-in from wearable data
  // (e.g. "10.000 passi" ticks itself once the Fit3 reports 10000 steps).
  `ALTER TABLE "Goal" ADD COLUMN IF NOT EXISTS "healthMetric" TEXT`,
  `ALTER TABLE "Goal" ADD COLUMN IF NOT EXISTS "healthTarget" DOUBLE PRECISION`,
  // One-shot tickets that ferry a session from the system browser into the
  // WebView during Google login from the APK (see src/lib/login-ticket.ts).
  // Only the ticket's hash is stored, never the spendable value.
  `CREATE TABLE IF NOT EXISTS "LoginTicket" (
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LoginTicket_pkey" PRIMARY KEY ("tokenHash"),
    CONSTRAINT "LoginTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `ALTER TABLE "LoginTicket" ENABLE ROW LEVEL SECURITY`,
];

/**
 * Applica le migration una per una, isolando i fallimenti.
 *
 * Prima il ciclo si fermava al primo errore: bastava un `ALTER TABLE` su una
 * tabella mai creata (era il caso di "MealLog") per lasciare indietro, in
 * silenzio, tutte le migration successive — 24 su 54. Il danno resta invisibile
 * finché non si aggiunge una colonna a schema.prisma: da lì Prisma la elenca in
 * ogni SELECT, e ogni query su quella tabella inizia a fallire in produzione.
 *
 * Gli statement sono tutti idempotenti e autonomi (nessuna transazione
 * comune), quindi saltarne uno non compromette i successivi.
 */
async function runMigrations() {
  const failed: { sql: string; message: string }[] = [];

  for (const sql of MIGRATIONS) {
    try {
      await prisma.$executeRawUnsafe(sql);
    } catch (e) {
      failed.push({
        sql: sql.replace(/\s+/g, " ").slice(0, 90),
        message: (e as Error).message.split("\n")[0],
      });
    }
  }

  console.log(`Migrations: ${MIGRATIONS.length - failed.length}/${MIGRATIONS.length} applied.`);
  // Rumoroso di proposito: una migration saltata va vista nei log della build,
  // non scoperta da un 500 in produzione.
  for (const f of failed) {
    console.warn(`  ⚠ skipped: ${f.sql}… → ${f.message}`);
  }
}

async function main() {
  await runMigrations();

  for (const cat of DEFAULT_CATEGORIES) {
    await prisma.category.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
  }
  console.log(`Seeded ${DEFAULT_CATEGORIES.length} categories.`);

  for (const ch of DAILY_CHALLENGES) {
    const existing = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM "DailyChallenge" WHERE "type" = $1 AND "title" = $2 LIMIT 1`,
      ch.type, ch.title
    );
    if (existing.length === 0) {
      const id = `ch_${Math.random().toString(36).slice(2, 11)}`;
      await prisma.$executeRawUnsafe(
        `INSERT INTO "DailyChallenge" ("id","title","description","xp","type") VALUES ($1,$2,$3,$4,$5)`,
        id, ch.title, ch.description, ch.xp, ch.type
      );
    }
  }
  console.log(`Seeded ${DAILY_CHALLENGES.length} daily challenges.`);
}

main()
  .catch((e) => {
    console.warn("Seed skipped (DB unreachable):", e.message);
    process.exit(0);
  })
  .finally(() => prisma.$disconnect());
