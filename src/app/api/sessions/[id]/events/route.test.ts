import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = {
  interviewSession: {
    findUnique: vi.fn(),
  },
  sessionEvent: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
};

vi.mock("@/lib/db", () => ({
  prisma,
}));

describe("session event routes", () => {
  beforeEach(() => {
    prisma.interviewSession.findUnique.mockReset();
    prisma.sessionEvent.findMany.mockReset();
    prisma.sessionEvent.create.mockReset();
  });

  it("lists events for a session", async () => {
    prisma.interviewSession.findUnique.mockResolvedValue({ id: "session-1" });
    prisma.sessionEvent.findMany.mockResolvedValue([{ id: "evt-1", eventType: "SESSION_CREATED" }]);

    const { GET } = await import("@/app/api/sessions/[id]/events/route");
    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: "session-1" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.events).toHaveLength(1);
  });

  it("creates a session event", async () => {
    prisma.interviewSession.findUnique.mockResolvedValue({ id: "session-1" });
    prisma.sessionEvent.create.mockResolvedValue({
      id: "evt-2",
      eventType: "HINT_REQUESTED",
    });

    const { POST } = await import("@/app/api/sessions/[id]/events/route");
    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: "HINT_REQUESTED",
          payloadJson: { source: "test" },
        }),
      }),
      {
        params: Promise.resolve({ id: "session-1" }),
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.ok).toBe(true);
    expect(prisma.sessionEvent.create).toHaveBeenCalledWith({
      data: {
        sessionId: "session-1",
        eventType: "HINT_REQUESTED",
        payloadJson: { source: "test" },
      },
    });
  });
});
