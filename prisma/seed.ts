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

// Applies schema changes that can't go through prisma db push on pooled connections.
// All statements are idempotent (ADD COLUMN IF NOT EXISTS).
const MIGRATIONS = [
  `ALTER TABLE "Goal" ADD COLUMN IF NOT EXISTS "reminderFrequency" TEXT`,
  `ALTER TABLE "Goal" ADD COLUMN IF NOT EXISTS "reminderDay" INTEGER`,
  `ALTER TABLE "Goal" ADD COLUMN IF NOT EXISTS "reminderDays" TEXT`,
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
}

main()
  .catch((e) => {
    console.warn("Seed skipped (DB unreachable):", e.message);
    process.exit(0);
  })
  .finally(() => prisma.$disconnect());
