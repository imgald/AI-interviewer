import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = {
  interviewSession: {
    findUnique: vi.fn(),
  },
  transcriptSegment: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  sessionEvent: {
    create: vi.fn(),
  },
};

vi.mock("@/lib/db", () => ({
  prisma,
}));

describe("session transcript routes", () => {
  beforeEach(() => {
    prisma.interviewSession.findUnique.mockReset();
    prisma.transcriptSegment.findMany.mockReset();
    prisma.transcriptSegment.findFirst.mockReset();
    prisma.transcriptSegment.create.mockReset();
    prisma.sessionEvent.create.mockReset();
  });

  it("lists transcript segments for a session", async () => {
    prisma.interviewSession.findUnique.mockResolvedValue({ id: "session-1" });
    prisma.transcriptSegment.findMany.mockResolvedValue([
      { id: "seg-1", text: "Hello", speaker: "AI", segmentIndex: 0 },
    ]);

    const { GET } = await import("@/app/api/sessions/[id]/transcripts/route");
    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: "session-1" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.transcripts).toHaveLength(1);
  });

  it("creates a transcript segment and logs a session event", async () => {
    prisma.interviewSession.findUnique.mockResolvedValue({ id: "session-1" });
    prisma.transcriptSegment.findFirst.mockResolvedValue({ segmentIndex: 1 });
    prisma.transcriptSegment.create.mockResolvedValue({
      id: "seg-2",
      sessionId: "session-1",
      speaker: "USER",
      segmentIndex: 2,
      text: "I would use a hash map.",
    });
    prisma.sessionEvent.create.mockResolvedValue({ id: "evt-1" });

    const { POST } = await import("@/app/api/sessions/[id]/transcripts/route");
    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          speaker: "USER",
          text: "I would use a hash map.",
          isFinal: true,
        }),
      }),
      {
        params: Promise.resolve({ id: "session-1" }),
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.ok).toBe(true);
    expect(prisma.transcriptSegment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sessionId: "session-1",
        speaker: "USER",
        segmentIndex: 2,
      }),
    });
    expect(prisma.sessionEvent.create).toHaveBeenCalledTimes(1);
  });
});
