import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/rewards", () => ({ checkAndAwardRewards: vi.fn().mockResolvedValue(undefined) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const prismaMock = {
  goal: { create: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
  milestone: { findMany: vi.fn(), findFirst: vi.fn(), createMany: vi.fn(), deleteMany: vi.fn(), update: vi.fn(), count: vi.fn() },
  user: { update: vi.fn() },
  $queryRawUnsafe: vi.fn(),
  $executeRawUnsafe: vi.fn(),
};
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { auth } from "@/lib/auth";
const authedSession = { user: { id: "user_1" } };

function req(body: unknown, method = "POST") {
  return new Request("http://localhost/api/goals", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function patchReq(body: unknown) {
  return new Request("http://localhost/api/goals/goal_1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue(authedSession as never);
});

describe("Auth guard", () => {
  it("returns 401 on POST goals when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as never);
    const { POST } = await import("@/app/api/goals/route");
    const res = await POST(req({ title: "Test" }));
    expect(res.status).toBe(401);
  });

  it("returns 401 on GET goals when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as never);
    const { GET } = await import("@/app/api/goals/route");
    const res = await GET(new Request("http://localhost/api/goals"));
    expect(res.status).toBe(401);
  });

  it("returns 401 on DELETE goal when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as never);
    const { DELETE } = await import("@/app/api/goals/[id]/route");
    const res = await DELETE(req(null, "DELETE"), { params: Promise.resolve({ id: "goal_1" }) });
    expect(res.status).toBe(401);
  });
});

describe("POST /api/goals — creation", () => {
  const baseGoal = { id: "goal_1", title: "Test", milestones: [], tags: [], category: null };

  it("returns 400 when title is missing", async () => {
    const { POST } = await import("@/app/api/goals/route");
    const res = await POST(req({ priority: "medium" }));
    expect(res.status).toBe(400);
  });

  it("creates goal and returns 201", async () => {
    prismaMock.goal.create.mockResolvedValueOnce(baseGoal);
    const { POST } = await import("@/app/api/goals/route");
    const res = await POST(req({ title: "Test" }));
    expect(res.status).toBe(201);
    expect(prismaMock.goal.create).toHaveBeenCalledOnce();
  });

  it("medium priority, no extras = 30 XP", async () => {
    prismaMock.goal.create.mockResolvedValueOnce(baseGoal);
    const { POST } = await import("@/app/api/goals/route");
    await POST(req({ title: "Test", priority: "medium" }));
    expect(prismaMock.goal.create.mock.calls[0][0].data.points).toBe(30);
  });

  it("low priority = 15 XP base", async () => {
    prismaMock.goal.create.mockResolvedValueOnce(baseGoal);
    const { POST } = await import("@/app/api/goals/route");
    await POST(req({ title: "Test", priority: "low" }));
    expect(prismaMock.goal.create.mock.calls[0][0].data.points).toBe(15);
  });

  it("high priority = 60 XP base", async () => {
    prismaMock.goal.create.mockResolvedValueOnce(baseGoal);
    const { POST } = await import("@/app/api/goals/route");
    await POST(req({ title: "Test", priority: "high" }));
    expect(prismaMock.goal.create.mock.calls[0][0].data.points).toBe(60);
  });

  it("adds +10 XP for target date", async () => {
    prismaMock.goal.create.mockResolvedValueOnce(baseGoal);
    const { POST } = await import("@/app/api/goals/route");
    await POST(req({ title: "Test", priority: "medium", targetDate: "2026-12-31" }));
    expect(prismaMock.goal.create.mock.calls[0][0].data.points).toBe(40);
  });

  it("adds +5 XP per milestone (max 5 milestones = +25)", async () => {
    prismaMock.goal.create.mockResolvedValueOnce(baseGoal);
    const { POST } = await import("@/app/api/goals/route");
    await POST(req({ title: "Test", priority: "medium", milestones: ["a", "b", "c", "d", "e"] }));
    expect(prismaMock.goal.create.mock.calls[0][0].data.points).toBe(55);
  });

  it("milestone bonus is capped at 5 even with more milestones", async () => {
    prismaMock.goal.create.mockResolvedValueOnce(baseGoal);
    const { POST } = await import("@/app/api/goals/route");
    await POST(req({ title: "Test", priority: "medium", milestones: ["a","b","c","d","e","f","g"] }));
    expect(prismaMock.goal.create.mock.calls[0][0].data.points).toBe(55);
  });

  it("adds +5 XP for description", async () => {
    prismaMock.goal.create.mockResolvedValueOnce(baseGoal);
    const { POST } = await import("@/app/api/goals/route");
    await POST(req({ title: "Test", priority: "medium", description: "A goal" }));
    expect(prismaMock.goal.create.mock.calls[0][0].data.points).toBe(35);
  });

  it("full combo: high + date + 5 milestones + description = 100 XP", async () => {
    prismaMock.goal.create.mockResolvedValueOnce(baseGoal);
    const { POST } = await import("@/app/api/goals/route");
    await POST(req({ title: "Test", priority: "high", targetDate: "2026-12-31", milestones: ["a","b","c","d","e"], description: "Full combo" }));
    expect(prismaMock.goal.create.mock.calls[0][0].data.points).toBe(100);
  });

  it("defaults priority to 'medium' when not provided", async () => {
    prismaMock.goal.create.mockResolvedValueOnce(baseGoal);
    const { POST } = await import("@/app/api/goals/route");
    await POST(req({ title: "Test" }));
    const data = prismaMock.goal.create.mock.calls[0][0].data;
    expect(data.priority).toBe("medium");
    expect(data.points).toBe(30);
  });
});

describe("PATCH /api/goals/[id] — completion", () => {
  const activeGoal = {
    id: "goal_1", userId: "user_1", title: "Test", status: "active", progress: 0,
    points: 30, completedAt: null, targetDate: null, isRecurring: false,
    recurrenceType: null, reminderTime: null, reminderFrequency: null,
    reminderDay: null, reminderDays: null, milestones: [],
  };

  it("awards XP when completing an active goal", async () => {
    prismaMock.goal.findFirst.mockResolvedValueOnce(activeGoal);
    // guard query: dailyCheckIn=false → no restriction
    prismaMock.$queryRawUnsafe.mockResolvedValueOnce([{ dailyCheckIn: false, progress: 0 }]);
    prismaMock.goal.update.mockResolvedValueOnce({ ...activeGoal, status: "completed", milestones: [], tags: [], category: null });
    prismaMock.user.update.mockResolvedValueOnce({});

    const { PATCH } = await import("@/app/api/goals/[id]/route");
    await PATCH(patchReq({ status: "completed", progress: 100 }), { params: Promise.resolve({ id: "goal_1" }) });

    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { points: { increment: 30 } } })
    );
  });

  it("does NOT award XP when goal was already completed", async () => {
    const alreadyDone = { ...activeGoal, status: "completed" };
    prismaMock.goal.findFirst.mockResolvedValueOnce(alreadyDone);
    prismaMock.goal.update.mockResolvedValueOnce({ ...alreadyDone, milestones: [], tags: [], category: null });

    const { PATCH } = await import("@/app/api/goals/[id]/route");
    await PATCH(patchReq({ status: "completed", progress: 100 }), { params: Promise.resolve({ id: "goal_1" }) });

    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("returns 404 when goal not found", async () => {
    prismaMock.goal.findFirst.mockResolvedValueOnce(null);
    const { PATCH } = await import("@/app/api/goals/[id]/route");
    const res = await PATCH(patchReq({ title: "Updated" }), { params: Promise.resolve({ id: "goal_1" }) });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/goals/[id]", () => {
  it("deletes goal and returns success", async () => {
    prismaMock.goal.findFirst.mockResolvedValueOnce({ id: "goal_1", userId: "user_1" });
    prismaMock.goal.delete.mockResolvedValueOnce({});
    const { DELETE } = await import("@/app/api/goals/[id]/route");
    const res = await DELETE(req(null, "DELETE"), { params: Promise.resolve({ id: "goal_1" }) });
    expect(res.status).toBe(200);
    expect(prismaMock.goal.delete).toHaveBeenCalledWith({ where: { id: "goal_1" } });
  });

  it("returns 404 when goal not found", async () => {
    prismaMock.goal.findFirst.mockResolvedValueOnce(null);
    const { DELETE } = await import("@/app/api/goals/[id]/route");
    const res = await DELETE(req(null, "DELETE"), { params: Promise.resolve({ id: "goal_1" }) });
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/goals/[id]/milestones — progress calculation", () => {
  const ms1 = { id: "ms_1", title: "Step 1", completed: false, order: 0, goalId: "goal_1", createdAt: new Date() };
  const ms2 = { id: "ms_2", title: "Step 2", completed: false, order: 1, goalId: "goal_1", createdAt: new Date() };
  const goal = {
    id: "goal_1", userId: "user_1", status: "active", progress: 0, points: 30,
    completedAt: null, isRecurring: false, milestones: [ms1, ms2],
  };

  it("sets progress to 50% after completing 1 of 2 milestones", async () => {
    prismaMock.goal.findFirst.mockResolvedValueOnce(goal);
    prismaMock.milestone.update.mockResolvedValueOnce({ ...ms1, completed: true });
    prismaMock.milestone.findMany.mockResolvedValueOnce([{ ...ms1, completed: true }, ms2]);
    prismaMock.goal.update.mockResolvedValueOnce({});
    prismaMock.user.update.mockResolvedValueOnce({});

    const { PATCH } = await import("@/app/api/goals/[id]/milestones/route");
    const r = new Request("http://localhost", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ milestoneId: "ms_1", completed: true }) });
    const res = await PATCH(r, { params: Promise.resolve({ id: "goal_1" }) });
    const body = await res.json();
    expect(body.progress).toBe(50);
  });
});
