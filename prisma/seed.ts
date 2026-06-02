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
  { title: "Early Bird", description: "Complete at least 1 milestone today", xp: 15, type: "complete_milestone" },
  { title: "Budget Tracker", description: "Log at least 1 expense today", xp: 10, type: "log_expense" },
  { title: "Habit Warrior", description: "Complete all your habits today", xp: 20, type: "check_habit" },
  { title: "Iron Scale", description: "Log your weight today", xp: 10, type: "log_weight" },
  { title: "Mindful Eater", description: "Log a meal today", xp: 10, type: "log_meal" },
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
];

async function main() {
  for (const sql of MIGRATIONS) {
    await prisma.$executeRawUnsafe(sql);
  }

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
