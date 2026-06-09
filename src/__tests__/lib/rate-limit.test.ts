import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/init-tables", () => ({ initAiUsageTable: vi.fn().mockResolvedValue(undefined) }));

const prismaMock = {
  $queryRawUnsafe: vi.fn(),
  $executeRawUnsafe: vi.fn(),
};
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.$executeRawUnsafe.mockResolvedValue(undefined);
});

describe("checkAndRecordAiUsage", () => {
  it("allows and records a usage when under the limit", async () => {
    prismaMock.$queryRawUnsafe.mockResolvedValueOnce([{ count: BigInt(3) }]);

    const { checkAndRecordAiUsage, AI_DAILY_LIMIT } = await import("@/lib/rate-limit");
    const res = await checkAndRecordAiUsage("user_1", "svuota-frigo");

    expect(res.allowed).toBe(true);
    expect(res.used).toBe(4);
    expect(res.limit).toBe(AI_DAILY_LIMIT);
    expect(prismaMock.$executeRawUnsafe).toHaveBeenCalledOnce(); // recorded
  });

  it("blocks and does NOT record when at the limit", async () => {
    const { checkAndRecordAiUsage, AI_DAILY_LIMIT } = await import("@/lib/rate-limit");
    prismaMock.$queryRawUnsafe.mockResolvedValueOnce([{ count: BigInt(AI_DAILY_LIMIT) }]);

    const res = await checkAndRecordAiUsage("user_1", "svuota-frigo");

    expect(res.allowed).toBe(false);
    expect(res.used).toBe(AI_DAILY_LIMIT);
    expect(prismaMock.$executeRawUnsafe).not.toHaveBeenCalled();
  });

  it("respects a custom limit", async () => {
    prismaMock.$queryRawUnsafe.mockResolvedValueOnce([{ count: BigInt(2) }]);

    const { checkAndRecordAiUsage } = await import("@/lib/rate-limit");
    const res = await checkAndRecordAiUsage("user_1", "svuota-frigo", 2);

    expect(res.allowed).toBe(false);
    expect(res.limit).toBe(2);
  });

  it("scopes the count query to user, endpoint and today", async () => {
    prismaMock.$queryRawUnsafe.mockResolvedValueOnce([{ count: BigInt(0) }]);

    const { checkAndRecordAiUsage } = await import("@/lib/rate-limit");
    await checkAndRecordAiUsage("user_42", "svuota-frigo");

    const [sql, userId, endpoint] = prismaMock.$queryRawUnsafe.mock.calls[0];
    expect(sql).toContain('"AiUsage"');
    expect(sql).toContain('"createdAt" >=');
    expect(userId).toBe("user_42");
    expect(endpoint).toBe("svuota-frigo");
  });
});
