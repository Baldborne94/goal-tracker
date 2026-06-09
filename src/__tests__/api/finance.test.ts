import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/rewards", () => ({
  checkAndAwardRewards: vi.fn().mockResolvedValue(undefined),
  checkAndAwardKakeeboRewards: vi.fn().mockResolvedValue(undefined),
}));

const prismaMock = {
  monthlyBudget: { findUnique: vi.fn(), upsert: vi.fn(), count: vi.fn() },
  expense: { findMany: vi.fn(), create: vi.fn(), findFirst: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn(), aggregate: vi.fn() },
  reward: { findUnique: vi.fn(), create: vi.fn() },
  userReward: { findFirst: vi.fn(), create: vi.fn() },
  user: { update: vi.fn() },
  $queryRawUnsafe: vi.fn(),
  $executeRawUnsafe: vi.fn(),
};
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { auth } from "@/lib/auth";
const authedSession = { user: { id: "user_1" } };

function postReq(url: string, body: unknown) {
  return new Request(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue(authedSession as never);
});

describe("POST /api/kakeebo/close-month", () => {
  it("returns success + 25 XP when spending is under budget", async () => {
    prismaMock.reward.findUnique.mockResolvedValueOnce(null);
    prismaMock.monthlyBudget.findUnique.mockResolvedValueOnce({ id: "bud_1", userId: "user_1", month: "2026-05", amount: 1000 });
    prismaMock.expense.findMany.mockResolvedValueOnce([{ amount: 800 }, { amount: 150 }]);
    prismaMock.reward.findUnique.mockResolvedValueOnce(null);
    prismaMock.reward.create.mockResolvedValueOnce({ id: "rew_1" });
    prismaMock.user.update.mockResolvedValueOnce({});
    prismaMock.userReward.create.mockResolvedValueOnce({});
    prismaMock.reward.findUnique.mockResolvedValue(null);
    prismaMock.monthlyBudget.count.mockResolvedValueOnce(1);
    prismaMock.expense.count.mockResolvedValueOnce(5);

    const { POST } = await import("@/app/api/kakeebo/close-month/route");
    const res = await POST(postReq("http://localhost/api/kakeebo/close-month", { month: "2026-05" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.xpEarned).toBe(25);
  });

  it("returns overBudget when spending exceeds budget", async () => {
    prismaMock.reward.findUnique.mockResolvedValueOnce(null);
    prismaMock.monthlyBudget.findUnique.mockResolvedValueOnce({ id: "bud_1", userId: "user_1", month: "2026-05", amount: 500 });
    prismaMock.expense.findMany.mockResolvedValueOnce([{ amount: 300 }, { amount: 250 }]);

    const { POST } = await import("@/app/api/kakeebo/close-month/route");
    const res = await POST(postReq("http://localhost/api/kakeebo/close-month", { month: "2026-05" }));
    const body = await res.json();

    expect(body.success).toBe(false);
    expect(body.overBudget).toBe(true);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("returns alreadyClosed when month was already claimed", async () => {
    prismaMock.reward.findUnique.mockResolvedValueOnce({ id: "rew_1" });
    prismaMock.userReward.findFirst.mockResolvedValueOnce({ id: "ur_1" });

    const { POST } = await import("@/app/api/kakeebo/close-month/route");
    const res = await POST(postReq("http://localhost/api/kakeebo/close-month", { month: "2026-05" }));
    const body = await res.json();

    expect(body.alreadyClosed).toBe(true);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("returns 400 when no budget is set for the month", async () => {
    prismaMock.reward.findUnique.mockResolvedValueOnce(null);
    prismaMock.monthlyBudget.findUnique.mockResolvedValueOnce(null);

    const { POST } = await import("@/app/api/kakeebo/close-month/route");
    const res = await POST(postReq("http://localhost/api/kakeebo/close-month", { month: "2026-05" }));
    expect(res.status).toBe(400);
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as never);
    const { POST } = await import("@/app/api/kakeebo/close-month/route");
    const res = await POST(postReq("http://localhost/api/kakeebo/close-month", { month: "2026-05" }));
    expect(res.status).toBe(401);
  });
});

describe("GET /api/bills", () => {
  it("returns bills list for the user", async () => {
    const bills = [
      { id: "bill_1", title: "Rent", amount: 800, dueDay: 1, category: "housing", notifyDaysBefore: 3, active: true },
      { id: "bill_2", title: "Netflix", amount: 12, dueDay: 15, category: "subscriptions", notifyDaysBefore: 1, active: true },
    ];
    prismaMock.$queryRawUnsafe.mockResolvedValueOnce(bills);

    const { GET } = await import("@/app/api/bills/route");
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveLength(2);
    expect(body[0].title).toBe("Rent");
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as never);
    const { GET } = await import("@/app/api/bills/route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns empty array when no bills exist", async () => {
    prismaMock.$queryRawUnsafe.mockResolvedValueOnce([]);
    const { GET } = await import("@/app/api/bills/route");
    const res = await GET();
    expect(await res.json()).toEqual([]);
  });
});

describe("POST /api/bills", () => {
  const newBill = { id: "bill_new", title: "Car payment", amount: 350.45, dueDay: 1, category: "transport", notifyDaysBefore: 3, active: true };

  it("creates a bill and returns it", async () => {
    prismaMock.$executeRawUnsafe.mockResolvedValue(undefined);
    prismaMock.$queryRawUnsafe.mockResolvedValueOnce([newBill]);

    const { POST } = await import("@/app/api/bills/route");
    const res = await POST(postReq("http://localhost/api/bills", {
      title: "Car payment", amount: 350.45, dueDay: 1, category: "transport", notifyDaysBefore: 3,
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.title).toBe("Car payment");
    expect(body.amount).toBe(350.45);
  });

  it("returns 400 when required fields are missing", async () => {
    const { POST } = await import("@/app/api/bills/route");
    const res = await POST(postReq("http://localhost/api/bills", { title: "Incomplete" }));
    expect(res.status).toBe(400);
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as never);
    const { POST } = await import("@/app/api/bills/route");
    const res = await POST(postReq("http://localhost/api/bills", { title: "X", amount: 10, dueDay: 1, category: "other" }));
    expect(res.status).toBe(401);
  });
});

describe("DELETE /api/bills/[id]", () => {
  it("deletes the bill and returns ok", async () => {
    prismaMock.$executeRawUnsafe.mockResolvedValueOnce(undefined);
    const { DELETE } = await import("@/app/api/bills/[id]/route");
    const res = await DELETE(
      new Request("http://localhost/api/bills/bill_1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "bill_1" }) }
    );
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as never);
    const { DELETE } = await import("@/app/api/bills/[id]/route");
    const res = await DELETE(
      new Request("http://localhost/api/bills/bill_1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "bill_1" }) }
    );
    expect(res.status).toBe(401);
  });
});

describe("PATCH /api/bills/[id]", () => {
  it("toggles active to false and returns updated bill", async () => {
    const updatedBill = { id: "bill_1", title: "Rent", amount: 800, dueDay: 1, category: "housing", notifyDaysBefore: 3, active: false };
    prismaMock.$executeRawUnsafe.mockResolvedValueOnce(undefined);
    prismaMock.$queryRawUnsafe.mockResolvedValueOnce([updatedBill]);

    const { PATCH } = await import("@/app/api/bills/[id]/route");
    const res = await PATCH(
      postReq("http://localhost/api/bills/bill_1", { active: false }),
      { params: Promise.resolve({ id: "bill_1" }) }
    );
    const body = await res.json();
    expect(body.active).toBe(false);
  });
});
