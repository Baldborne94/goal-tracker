import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/init-tables", () => ({ initSvuotaFrigoTable: vi.fn().mockResolvedValue(undefined) }));

const prismaMock = {
  $queryRawUnsafe: vi.fn(),
  $executeRawUnsafe: vi.fn(),
};
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { auth } from "@/lib/auth";
const authedSession = { user: { id: "user_1" } };

function jsonReq(url: string, body: unknown, method = "POST") {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue(authedSession as never);
  prismaMock.$executeRawUnsafe.mockResolvedValue(undefined);
});

describe("GET /api/svuota-frigo", () => {
  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as never);
    const { GET } = await import("@/app/api/svuota-frigo/route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("parses ingredients JSON for each saved recipe", async () => {
    prismaMock.$queryRawUnsafe.mockResolvedValueOnce([
      { id: "r1", ingredients: '["uova","spinaci"]', content: "Frittata", createdAt: new Date() },
    ]);
    const { GET } = await import("@/app/api/svuota-frigo/route");
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body[0].ingredients).toEqual(["uova", "spinaci"]);
    expect(body[0].content).toBe("Frittata");
  });
});

describe("POST /api/svuota-frigo/save", () => {
  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as never);
    const { POST } = await import("@/app/api/svuota-frigo/save/route");
    const res = await POST(jsonReq("http://localhost/api/svuota-frigo/save", { ingredients: ["uova"], content: "x" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when ingredients or content missing", async () => {
    const { POST } = await import("@/app/api/svuota-frigo/save/route");
    const res = await POST(jsonReq("http://localhost/api/svuota-frigo/save", { ingredients: [], content: "" }));
    expect(res.status).toBe(400);
  });

  it("inserts the recipe and returns it with parsed ingredients", async () => {
    prismaMock.$queryRawUnsafe.mockResolvedValueOnce([
      { id: "r_new", ingredients: '["uova","spinaci"]', content: "Frittata", createdAt: new Date() },
    ]);
    const { POST } = await import("@/app/api/svuota-frigo/save/route");
    const res = await POST(jsonReq("http://localhost/api/svuota-frigo/save", {
      ingredients: ["uova", "spinaci"], content: "Frittata",
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(prismaMock.$executeRawUnsafe).toHaveBeenCalledOnce();
    expect(body.ingredients).toEqual(["uova", "spinaci"]);
  });
});

describe("DELETE /api/svuota-frigo/[id]", () => {
  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as never);
    const { DELETE } = await import("@/app/api/svuota-frigo/[id]/route");
    const res = await DELETE(new Request("http://localhost/api/svuota-frigo/r1", { method: "DELETE" }), { params: Promise.resolve({ id: "r1" }) });
    expect(res.status).toBe(401);
  });

  it("scopes the delete to the authenticated user", async () => {
    const { DELETE } = await import("@/app/api/svuota-frigo/[id]/route");
    const res = await DELETE(new Request("http://localhost/api/svuota-frigo/r1", { method: "DELETE" }), { params: Promise.resolve({ id: "r1" }) });

    expect(res.status).toBe(200);
    const [sql, id, userId] = prismaMock.$executeRawUnsafe.mock.calls[0];
    expect(sql).toContain("DELETE FROM");
    expect(sql).toContain('"userId"');
    expect(id).toBe("r1");
    expect(userId).toBe("user_1");
  });
});
