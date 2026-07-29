import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

const prismaMock = {
  user: { update: vi.fn() },
  milestone: { count: vi.fn() },
  expense: { count: vi.fn() },
  goal: { count: vi.fn() },
  weightEntry: { count: vi.fn() },
  $queryRawUnsafe: vi.fn(),
  $executeRawUnsafe: vi.fn(),
};
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { auth } from "@/lib/auth";
const authedSession = { user: { id: "user_1" } };

function claimReq() {
  return new Request("http://localhost/api/challenges/ch_g0_meals/claim", { method: "POST" });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue(authedSession as never);
  prismaMock.$executeRawUnsafe.mockResolvedValue(undefined);
  prismaMock.user.update.mockResolvedValue({});
});

describe("POST /api/challenges/[id]/claim — complete_meals condition", () => {
  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as never);
    const { POST } = await import("@/app/api/challenges/[id]/claim/route");
    const res = await POST(claimReq(), { params: Promise.resolve({ id: "ch_g0_meals" }) });
    expect(res.status).toBe(401);
  });

  it("awards XP when at least one food entry is logged today", async () => {
    prismaMock.$queryRawUnsafe
      .mockResolvedValueOnce([{ id: "ch_g0_meals", xp: 20, type: "complete_meals" }]) // challenge lookup
      .mockResolvedValueOnce([])                                                       // existing UserDailyChallenge (none)
      .mockResolvedValueOnce([{ count: BigInt(1) }]);                                  // FoodEntry count

    const { POST } = await import("@/app/api/challenges/[id]/claim/route");
    const res = await POST(claimReq(), { params: Promise.resolve({ id: "ch_g0_meals" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.xp).toBe(20);
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { points: { increment: 20 } } })
    );
  });

  it("rejects the claim when no food entry is logged today", async () => {
    prismaMock.$queryRawUnsafe
      .mockResolvedValueOnce([{ id: "ch_g0_meals", xp: 20, type: "complete_meals" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ count: BigInt(0) }]);

    const { POST } = await import("@/app/api/challenges/[id]/claim/route");
    const res = await POST(claimReq(), { params: Promise.resolve({ id: "ch_g0_meals" }) });

    expect(res.status).toBe(400);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("counts only FoodEntry — the nutritionist's MealCompletion is gone", async () => {
    prismaMock.$queryRawUnsafe
      .mockResolvedValueOnce([{ id: "ch_g0_meals", xp: 20, type: "complete_meals" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ count: BigInt(1) }]);

    const { POST } = await import("@/app/api/challenges/[id]/claim/route");
    await POST(claimReq(), { params: Promise.resolve({ id: "ch_g0_meals" }) });

    const countCall = prismaMock.$queryRawUnsafe.mock.calls[2];
    expect(countCall[0]).toContain('"FoodEntry"');
    expect(countCall[0]).not.toContain('"MealCompletion"');
  });

  it("rejects an already-claimed challenge", async () => {
    prismaMock.$queryRawUnsafe
      .mockResolvedValueOnce([{ id: "ch_g0_meals", xp: 20, type: "complete_meals" }])
      .mockResolvedValueOnce([{ completed: true }]); // already claimed

    const { POST } = await import("@/app/api/challenges/[id]/claim/route");
    const res = await POST(claimReq(), { params: Promise.resolve({ id: "ch_g0_meals" }) });

    expect(res.status).toBe(400);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });
});
