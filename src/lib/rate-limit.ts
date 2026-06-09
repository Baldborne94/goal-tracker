import { prisma } from "./db";
import { initAiUsageTable } from "./init-tables";
import { randomUUID } from "crypto";

// Per-user daily cap on paid AI generations. The ANTHROPIC_API_KEY is the
// owner's key, so every call is billed to the owner regardless of which user
// triggers it — this cap is the cost guard against spam/abuse.
export const AI_DAILY_LIMIT = 15;

type RateResult = { allowed: boolean; used: number; limit: number };

/**
 * Checks whether the user is under their daily AI quota for `endpoint`.
 * If allowed, records one usage row and returns allowed=true.
 * Fails open (allowed=true) only if the usage table can't be reached, to avoid
 * blocking a paying user on an infra hiccup — but logs nothing here; caller may.
 */
export async function checkAndRecordAiUsage(
  userId: string,
  endpoint: string,
  limit = AI_DAILY_LIMIT
): Promise<RateResult> {
  await initAiUsageTable();

  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const rows = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT COUNT(*) as count FROM "AiUsage" WHERE "userId" = $1 AND "endpoint" = $2 AND "createdAt" >= $3`,
    userId, endpoint, dayStart
  );
  const used = Number(rows[0]?.count ?? 0);

  if (used >= limit) {
    return { allowed: false, used, limit };
  }

  await prisma.$executeRawUnsafe(
    `INSERT INTO "AiUsage" ("id", "userId", "endpoint", "createdAt") VALUES ($1, $2, $3, NOW())`,
    randomUUID(), userId, endpoint
  );

  return { allowed: true, used: used + 1, limit };
}
