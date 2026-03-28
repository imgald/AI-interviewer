import { describe, expect, it } from "vitest";
import { buildUnifiedOpsFeed, type AdminProfileDetail } from "@/lib/admin/ops";

describe("buildUnifiedOpsFeed", () => {
  const detail: AdminProfileDetail = {
    profile: {
      id: "profile-1",
      sourceUrl: "https://example.com/jane",
      sourceType: "PERSONAL_SITE",
      status: "READY",
      fetchStatus: "SUCCEEDED",
      personaSummary: null,
      currentRole: null,
      currentCompany: null,
      createdAt: "2026-03-28T00:00:00.000Z",
      updatedAt: "2026-03-28T00:00:00.000Z",
    },
    job: null,
    personaEvents: [
      {
        id: "p1",
        source: "persona",
        eventType: "JOB_ENQUEUED",
        createdAt: "2026-03-28T00:00:10.000Z",
        title: "Job Enqueued",
        description: "Queued.",
        payloadJson: null,
        interviewerProfileId: "profile-1",
      },
    ],
    sessionEvents: [
      {
        id: "s1",
        source: "session",
        eventType: "SESSION_CREATED",
        createdAt: "2026-03-28T00:00:20.000Z",
        title: "Session Created",
        description: "Session created.",
        payloadJson: null,
        sessionId: "session-1",
        interviewerProfileId: "profile-1",
      },
    ],
  };

  it("returns all events sorted by newest first", () => {
    const result = buildUnifiedOpsFeed(detail, "all");
    expect(result).toHaveLength(2);
    expect(result[0]?.id).toBe("s1");
    expect(result[1]?.id).toBe("p1");
  });

  it("filters to persona events", () => {
    const result = buildUnifiedOpsFeed(detail, "persona");
    expect(result).toHaveLength(1);
    expect(result[0]?.source).toBe("persona");
  });

  it("filters to session events", () => {
    const result = buildUnifiedOpsFeed(detail, "session");
    expect(result).toHaveLength(1);
    expect(result[0]?.source).toBe("session");
  });
});
