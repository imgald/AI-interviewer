import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = {
  interviewSession: {
    findUnique: vi.fn(),
  },
  sessionEvent: {
    findMany: vi.fn(),
  },
};

vi.mock("@/lib/db", () => ({
  prisma,
}));

describe("session detail route", () => {
  beforeEach(() => {
    prisma.interviewSession.findUnique.mockReset();
    prisma.sessionEvent.findMany.mockReset();
  });

  it("returns only the latest committed transcript chain and truth summary", async () => {
    prisma.interviewSession.findUnique.mockResolvedValue({
      id: "session-1",
      mode: "CODING",
      status: "ACTIVE",
      targetLevel: "SDE2",
      selectedLanguage: "PYTHON",
      voiceEnabled: true,
      personaEnabled: true,
      question: { title: "Two Sum", prompt: "Find two indices." },
      interviewerProfile: null,
      interviewerContext: null,
      evaluation: null,
      feedbackReport: null,
      transcripts: [
        { id: "seg-1", speaker: "USER", text: "I will start coding now.", segmentIndex: 0, isFinal: true, createdAt: new Date("2026-04-07T00:00:00.000Z") },
        { id: "seg-2", speaker: "USER", text: "I would first clarify the constraints.", segmentIndex: 1, isFinal: true, createdAt: new Date("2026-04-07T00:00:05.000Z") },
        { id: "seg-3", speaker: "USER", text: "live partial", segmentIndex: 2, isFinal: false, createdAt: new Date("2026-04-07T00:00:06.000Z") },
      ],
      events: [
        { id: "evt-1", eventType: "STAGE_ADVANCED", eventTime: new Date("2026-04-07T00:00:07.000Z"), payloadJson: { stage: "APPROACH_DISCUSSION" } },
      ],
      executionRuns: [],
    });
    prisma.sessionEvent.findMany.mockResolvedValue([
      {
        id: "evt-refine",
        eventType: "CANDIDATE_TRANSCRIPT_REFINED",
        eventTime: new Date("2026-04-07T00:00:05.000Z"),
        payloadJson: { transcriptSegmentId: "seg-2", correctionOfId: "seg-1" },
      },
    ]);

    const { GET } = await import("@/app/api/sessions/[id]/route");
    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: "session-1" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.transcripts).toHaveLength(1);
    expect(payload.data.transcripts[0]).toMatchObject({
      id: "seg-2",
      text: "I would first clarify the constraints.",
      commitState: "COMMITTED",
      transcriptVersion: 2,
      correctionOfId: "seg-1",
    });
    expect(payload.data.transcriptTruth).toMatchObject({
      totalSegments: 3,
      pendingCount: 1,
      activeCommittedCount: 1,
      supersededCount: 1,
      versionedCount: 1,
    });
  });
});
