import { describe, expect, it } from "vitest";
import {
  buildTranscriptVersionIndex,
  decorateTranscriptForRead,
  deriveTranscriptCommitState,
  getCommittedTranscriptSegments,
  summarizeTranscriptTruth,
} from "@/lib/session/commit-arbiter";

describe("commit arbiter", () => {
  it("treats non-final transcript segments as pending", () => {
    expect(deriveTranscriptCommitState({ isFinal: false })).toBe("PENDING");
    expect(deriveTranscriptCommitState({ isFinal: true })).toBe("COMMITTED");
    expect(deriveTranscriptCommitState({ isFinal: undefined })).toBe("COMMITTED");
  });

  it("filters assistant decision input down to committed transcripts only", () => {
    const transcripts = [
      { id: "seg-1", speaker: "USER" as const, text: "live partial", segmentIndex: 0, isFinal: false },
      { id: "seg-2", speaker: "USER" as const, text: "final answer", segmentIndex: 1, isFinal: true },
    ];

    expect(getCommittedTranscriptSegments(transcripts)).toEqual([transcripts[1]]);
  });

  it("uses only the latest committed correction in a transcript chain", () => {
    const transcripts = [
      { id: "seg-1", speaker: "USER" as const, text: "old final", segmentIndex: 0, isFinal: true },
      { id: "seg-2", speaker: "USER" as const, text: "corrected final", segmentIndex: 1, isFinal: true },
    ];
    const events = [
      {
        eventType: "CANDIDATE_TRANSCRIPT_REFINED",
        payloadJson: {
          transcriptSegmentId: "seg-2",
          correctionOfId: "seg-1",
        },
      },
    ];

    expect(getCommittedTranscriptSegments(transcripts, events)).toEqual([transcripts[1]]);
    expect(buildTranscriptVersionIndex(transcripts, events).get("seg-2")).toMatchObject({
      correctionOfId: "seg-1",
      transcriptVersion: 2,
    });
  });

  it("decorates transcript reads with commit metadata", () => {
    expect(
      decorateTranscriptForRead(
        {
          id: "seg-1",
          speaker: "USER",
          text: "final answer",
          segmentIndex: 0,
          isFinal: true,
        },
        { correctionOfId: "seg-0" },
      ),
    ).toMatchObject({
      commitState: "COMMITTED",
      transcriptVersion: 1,
      correctionOfId: "seg-0",
      supersededById: null,
    });
  });

  it("summarizes transcript truth state for audit views", () => {
    const transcripts = [
      { id: "seg-1", speaker: "USER" as const, text: "old", segmentIndex: 0, isFinal: true },
      { id: "seg-2", speaker: "USER" as const, text: "new", segmentIndex: 1, isFinal: true },
      { id: "seg-3", speaker: "USER" as const, text: "live partial", segmentIndex: 2, isFinal: false },
    ];
    const events = [
      {
        eventType: "CANDIDATE_TRANSCRIPT_REFINED",
        payloadJson: {
          transcriptSegmentId: "seg-2",
          correctionOfId: "seg-1",
        },
      },
    ];

    expect(summarizeTranscriptTruth(transcripts, events)).toEqual({
      totalSegments: 3,
      pendingCount: 1,
      committedCount: 2,
      activeCommittedCount: 1,
      supersededCount: 1,
      versionedCount: 1,
    });
  });
});
