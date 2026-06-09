/**
 * Tests for recurring quest with daily check-in:
 * 1. Creating a recurring quest saves dailyCheckIn / checkInXP / checkInDays
 * 2. Manually completing a recurring quest clones it with the same check-in settings
 * 3. Completing the last milestone on a recurring quest clones it with check-in settings
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: "user_test" } }),
}));

vi.mock("@/lib/rewards", () => ({
  checkAndAwardRewards: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Prisma mock — we define the shape once and reset per test
const prismaMock = {
  goal: {
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
  },
  milestone: {
    update: vi.fn(),
    findMany: vi.fn(),
    createMany: vi.fn(),
    findFirst: vi.fn(),
    deleteMany: vi.fn(),
  },
  user: { update: vi.fn() },
  $queryRawUnsafe: vi.fn().mockResolvedValue([]),
  $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
};

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/goals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makePatchRequest(body: unknown): Request {
  return new Request("http://localhost/api/goals/goal_abc", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** A base recurring goal that already exists in the DB */
const baseExistingGoal = {
  id: "goal_abc",
  userId: "user_test",
  title: "Water plants",
  description: null,
  priority: "medium",
  status: "active",
  progress: 0,
  points: 40,
  targetDate: new Date("2026-06-30"),
  completedAt: null,
  categoryId: null,
  isRecurring: true,
  recurrenceType: "weekly",
  reminderTime: "12:00",
  reminderFrequency: "weekly",
  reminderDay: 0,
  reminderDays: null,
  milestones: [],
};

/** Simulates what $queryRawUnsafe returns for check-in fields */
const checkInFields = [{ dailyCheckIn: true, checkInXP: 5, checkInDays: "0" }];

// ── Tests ────────────────────────────────────────────────────────────────────

describe("Recurring quest with daily check-in", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 1. Creation ─────────────────────────────────────────────────────────

  describe("POST /api/goals — creation", () => {
    it("saves dailyCheckIn, checkInXP and checkInDays on the new goal", async () => {
      const createdGoal = {
        id: "goal_new",
        title: "Water plants",
        isRecurring: true,
        dailyCheckIn: true,
        checkInXP: 5,
        checkInDays: "0",
        milestones: [],
        tags: [],
        category: null,
      };
      prismaMock.goal.create.mockResolvedValueOnce(createdGoal);

      const { POST } = await import("@/app/api/goals/route");
      const req = makeRequest({
        title: "Water plants",
        priority: "medium",
        targetDate: "2026-06-30",
        isRecurring: true,
        recurrenceType: "weekly",
        dailyCheckIn: true,
        checkInXP: 5,
        checkInDays: "0",
      });

      const res = await POST(req);
      expect(res.status).toBe(201);

      const createCall = prismaMock.goal.create.mock.calls[0][0];
      expect(createCall.data.isRecurring).toBe(true);
      expect(createCall.data.dailyCheckIn).toBe(true);
      expect(createCall.data.checkInXP).toBe(5);
      expect(createCall.data.checkInDays).toBe("0");
    });

    it("does NOT store checkInDays when dailyCheckIn is false", async () => {
      const createdGoal = { id: "goal_new", title: "Study", dailyCheckIn: false, checkInDays: null, milestones: [], tags: [], category: null };
      prismaMock.goal.create.mockResolvedValueOnce(createdGoal);

      const { POST } = await import("@/app/api/goals/route");
      const req = makeRequest({ title: "Study", dailyCheckIn: false });
      await POST(req);

      const createCall = prismaMock.goal.create.mock.calls[0][0];
      expect(createCall.data.dailyCheckIn).toBe(false);
      expect(createCall.data.checkInDays).toBeNull();
    });

    it("returns 400 when title is missing", async () => {
      const { POST } = await import("@/app/api/goals/route");
      const req = makeRequest({ dailyCheckIn: true });
      const res = await POST(req);
      expect(res.status).toBe(400);
      prismaMock.goal.create.mockReset();
    });
  });

  // ── 2. Manual completion → clone ─────────────────────────────────────────

  describe("PATCH /api/goals/[id] — manual completion clones recurring quest", () => {
    it("creates a clone when completing a recurring quest manually", async () => {
      prismaMock.goal.findFirst.mockResolvedValueOnce(baseExistingGoal);
      prismaMock.goal.update.mockResolvedValueOnce({ ...baseExistingGoal, status: "completed", progress: 100, milestones: [], tags: [], category: null });
      prismaMock.user.update.mockResolvedValueOnce({});
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce(checkInFields);
      prismaMock.goal.create.mockResolvedValueOnce({ id: "goal_clone" });

      const { PATCH } = await import("@/app/api/goals/[id]/route");
      const req = makePatchRequest({ status: "completed", progress: 100 });
      const res = await PATCH(req, { params: Promise.resolve({ id: "goal_abc" }) });

      expect(res.status).toBe(200);
      expect(prismaMock.goal.create).toHaveBeenCalledOnce();

      const cloneData = prismaMock.goal.create.mock.calls[0][0].data;
      expect(cloneData.title).toBe("Water plants");
      expect(cloneData.isRecurring).toBe(true);
    });

    it("copies dailyCheckIn settings to the cloned quest", async () => {
      prismaMock.goal.findFirst.mockResolvedValueOnce(baseExistingGoal);
      prismaMock.goal.update.mockResolvedValueOnce({ ...baseExistingGoal, status: "completed", progress: 100, milestones: [], tags: [], category: null });
      prismaMock.user.update.mockResolvedValueOnce({});
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce([]);           // first call: progress gate check
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce(checkInFields); // second call: read fields for clone
      prismaMock.goal.create.mockResolvedValueOnce({ id: "goal_clone" });

      const { PATCH } = await import("@/app/api/goals/[id]/route");
      const req = makePatchRequest({ status: "completed", progress: 100 });
      await PATCH(req, { params: Promise.resolve({ id: "goal_abc" }) });

      // $executeRawUnsafe should be called to copy check-in fields to clone
      const rawCalls = prismaMock.$executeRawUnsafe.mock.calls;
      const checkInCopyCall = rawCalls.find((call: unknown[]) =>
        typeof call[0] === "string" && call[0].includes('"dailyCheckIn"') && call[0].includes("UPDATE")
      );
      expect(checkInCopyCall).toBeDefined();
      expect(checkInCopyCall![1]).toBe(true);   // dailyCheckIn = true
      expect(checkInCopyCall![2]).toBe(5);       // checkInXP = 5
      expect(checkInCopyCall![3]).toBe("0");     // checkInDays = "0" (Sunday)
    });

    it("does NOT clone when the quest is not recurring", async () => {
      const nonRecurring = { ...baseExistingGoal, isRecurring: false };
      prismaMock.goal.findFirst.mockResolvedValueOnce(nonRecurring);
      prismaMock.goal.update.mockResolvedValueOnce({ ...nonRecurring, status: "completed", milestones: [], tags: [], category: null });
      prismaMock.user.update.mockResolvedValueOnce({});

      const { PATCH } = await import("@/app/api/goals/[id]/route");
      const req = makePatchRequest({ status: "completed", progress: 100 });
      await PATCH(req, { params: Promise.resolve({ id: "goal_abc" }) });

      expect(prismaMock.goal.create).not.toHaveBeenCalled();
    });

    it("advances target date by 7 days for weekly recurrence", async () => {
      prismaMock.goal.findFirst.mockResolvedValueOnce(baseExistingGoal);
      prismaMock.goal.update.mockResolvedValueOnce({ ...baseExistingGoal, status: "completed", progress: 100, milestones: [], tags: [], category: null });
      prismaMock.user.update.mockResolvedValueOnce({});
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce([{ dailyCheckIn: false, checkInXP: 5, checkInDays: null }]);
      prismaMock.goal.create.mockResolvedValueOnce({ id: "goal_clone" });

      const { PATCH } = await import("@/app/api/goals/[id]/route");
      const req = makePatchRequest({ status: "completed", progress: 100 });
      await PATCH(req, { params: Promise.resolve({ id: "goal_abc" }) });

      const cloneData = prismaMock.goal.create.mock.calls[0][0].data;
      const expected = new Date("2026-06-30");
      expected.setDate(expected.getDate() + 7);
      expect(cloneData.targetDate?.toDateString()).toBe(expected.toDateString());
    });
  });

  // ── 3. Milestone completion → clone ──────────────────────────────────────

  describe("PATCH /api/goals/[id]/milestones — last milestone clones recurring quest", () => {
    const milestone = { id: "ms_1", title: "Plant seeds", completed: false, order: 0, goalId: "goal_abc", createdAt: new Date() };
    const goalWithMilestone = { ...baseExistingGoal, milestones: [milestone] };

    it("creates a clone when the last milestone is completed", async () => {
      prismaMock.goal.findFirst.mockResolvedValueOnce(goalWithMilestone);
      prismaMock.milestone.update.mockResolvedValueOnce({ ...milestone, completed: true });
      prismaMock.milestone.findMany.mockResolvedValueOnce([{ ...milestone, completed: true }]);
      prismaMock.goal.update.mockResolvedValueOnce({});
      prismaMock.user.update.mockResolvedValueOnce({});
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce(checkInFields);
      prismaMock.goal.create.mockResolvedValueOnce({ id: "goal_clone" });

      const { PATCH } = await import("@/app/api/goals/[id]/milestones/route");
      const req = makePatchRequest({ milestoneId: "ms_1", completed: true });
      const res = await PATCH(req, { params: Promise.resolve({ id: "goal_abc" }) });

      expect(res.status).toBe(200);
      expect(prismaMock.goal.create).toHaveBeenCalledOnce();
    });

    it("copies dailyCheckIn settings to the cloned quest via milestone path", async () => {
      prismaMock.goal.findFirst.mockResolvedValueOnce(goalWithMilestone);
      prismaMock.milestone.update.mockResolvedValueOnce({ ...milestone, completed: true });
      prismaMock.milestone.findMany.mockResolvedValueOnce([{ ...milestone, completed: true }]);
      prismaMock.goal.update.mockResolvedValueOnce({});
      prismaMock.user.update.mockResolvedValueOnce({});
      prismaMock.$queryRawUnsafe.mockResolvedValueOnce(checkInFields);
      prismaMock.goal.create.mockResolvedValueOnce({ id: "goal_clone" });

      const { PATCH } = await import("@/app/api/goals/[id]/milestones/route");
      const req = makePatchRequest({ milestoneId: "ms_1", completed: true });
      await PATCH(req, { params: Promise.resolve({ id: "goal_abc" }) });

      const rawCalls = prismaMock.$executeRawUnsafe.mock.calls;
      const checkInCopyCall = rawCalls.find((call: unknown[]) =>
        typeof call[0] === "string" && call[0].includes('"dailyCheckIn"') && call[0].includes("UPDATE")
      );
      expect(checkInCopyCall).toBeDefined();
      expect(checkInCopyCall![1]).toBe(true);
      expect(checkInCopyCall![2]).toBe(5);
      expect(checkInCopyCall![3]).toBe("0");
    });

    it("does NOT clone when there are still incomplete milestones", async () => {
      const ms2 = { id: "ms_2", title: "Water daily", completed: false, order: 1, goalId: "goal_abc", createdAt: new Date() };
      prismaMock.goal.findFirst.mockResolvedValueOnce({ ...goalWithMilestone, milestones: [milestone, ms2] });
      prismaMock.milestone.update.mockResolvedValueOnce({ ...milestone, completed: true });
      // ms2 still incomplete → progress = 50%
      prismaMock.milestone.findMany.mockResolvedValueOnce([{ ...milestone, completed: true }, { ...ms2, completed: false }]);
      prismaMock.goal.update.mockResolvedValueOnce({});
      prismaMock.user.update.mockResolvedValueOnce({});

      const { PATCH } = await import("@/app/api/goals/[id]/milestones/route");
      const req = makePatchRequest({ milestoneId: "ms_1", completed: true });
      await PATCH(req, { params: Promise.resolve({ id: "goal_abc" }) });

      expect(prismaMock.goal.create).not.toHaveBeenCalled();
    });
  });
});
