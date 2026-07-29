import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const prismaMock = {
  user: { update: vi.fn() },
  milestone: { count: vi.fn() },
  $queryRawUnsafe: vi.fn(),
  $executeRawUnsafe: vi.fn(),
};
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { auth } from "@/lib/auth";
const authedSession = { user: { id: "user_1" } };

function postReq(body: unknown) {
  return new Request("http://localhost/api/goals/goal_1/checkin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const TODAY = new Date().toISOString().slice(0, 10);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue(authedSession as never);
  prismaMock.$executeRawUnsafe.mockResolvedValue(undefined);
  // Valore di ripiego: le catene `...Once` restano il contratto del test, ma
  // una query interna in più (il registro della scheda) non le sfasa.
  prismaMock.$queryRawUnsafe.mockResolvedValue([]);
});

describe("POST /api/goals/[id]/checkin", () => {
  it("creates a check-in and awards XP", async () => {
    prismaMock.$queryRawUnsafe
      .mockResolvedValueOnce([{ checkInXP: 10, createdAt: new Date("2026-01-01"), targetDate: null, checkInDays: null }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ count: BigInt(1) }]);

    prismaMock.milestone.count.mockResolvedValueOnce(0);
    prismaMock.user.update.mockResolvedValueOnce({});

    const { POST } = await import("@/app/api/goals/[id]/checkin/route");
    const res = await POST(postReq({ note: "Done!" }), { params: Promise.resolve({ id: "goal_1" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.xp).toBe(10);
    expect(body.date).toBe(TODAY);
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { points: { increment: 10 } } })
    );
  });

  it("returns 409 when already checked in today", async () => {
    prismaMock.$queryRawUnsafe
      .mockResolvedValueOnce([{ checkInXP: 5, createdAt: new Date(), targetDate: null, checkInDays: null }])
      .mockResolvedValueOnce([{ id: "qci_existing" }]);

    const { POST } = await import("@/app/api/goals/[id]/checkin/route");
    const res = await POST(postReq({}), { params: Promise.resolve({ id: "goal_1" }) });

    expect(res.status).toBe(409);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("returns 404 when quest does not have dailyCheckIn enabled", async () => {
    prismaMock.$queryRawUnsafe.mockResolvedValueOnce([]);

    const { POST } = await import("@/app/api/goals/[id]/checkin/route");
    const res = await POST(postReq({}), { params: Promise.resolve({ id: "goal_1" }) });

    expect(res.status).toBe(404);
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as never);
    const { POST } = await import("@/app/api/goals/[id]/checkin/route");
    const res = await POST(postReq({}), { params: Promise.resolve({ id: "goal_1" }) });
    expect(res.status).toBe(401);
  });

  it("calculates progress for milestone-less quests", async () => {
    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - 6);
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 90);

    prismaMock.$queryRawUnsafe
      .mockResolvedValueOnce([{ checkInXP: 5, createdAt, targetDate, checkInDays: null }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ count: BigInt(1) }]);

    prismaMock.milestone.count.mockResolvedValueOnce(0);
    prismaMock.user.update.mockResolvedValueOnce({});

    const { POST } = await import("@/app/api/goals/[id]/checkin/route");
    const res = await POST(postReq({}), { params: Promise.resolve({ id: "goal_1" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.progress).toBeGreaterThan(0);
    expect(body.progress).toBeLessThanOrEqual(100);
  });
});

describe("GET /api/goals/[id]/checkin", () => {
  it("returns check-in history for the quest", async () => {
    const history = [
      { id: "qci_1", date: "2026-06-01", note: null, xpAwarded: 5 },
      { id: "qci_2", date: "2026-06-02", note: "Done well", xpAwarded: 5 },
    ];
    prismaMock.$queryRawUnsafe.mockResolvedValueOnce(history);

    const { GET } = await import("@/app/api/goals/[id]/checkin/route");
    const res = await GET(new Request("http://localhost/api/goals/goal_1/checkin"), { params: Promise.resolve({ id: "goal_1" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveLength(2);
    expect(body[0].date).toBe("2026-06-01");
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as never);
    const { GET } = await import("@/app/api/goals/[id]/checkin/route");
    const res = await GET(new Request("http://localhost"), { params: Promise.resolve({ id: "goal_1" }) });
    expect(res.status).toBe(401);
  });
});
