import { describe, expect, it } from "vitest";
import { deriveCurrentCodingStage, inferSuggestedCodingStage } from "@/lib/assistant/stages";

describe("assistant stages", () => {
  it("uses the latest explicit stage transition when present", () => {
    const stage = deriveCurrentCodingStage({
      events: [
        {
          eventType: "STAGE_ADVANCED",
          eventTime: "2026-03-28T00:00:00.000Z",
          payloadJson: { stage: "APPROACH_DISCUSSION" },
        },
        {
          eventType: "STAGE_ADVANCED",
          eventTime: "2026-03-28T00:01:00.000Z",
          payloadJson: { stage: "IMPLEMENTATION" },
        },
      ],
      transcripts: [],
      latestExecutionRun: null,
    });

    expect(stage).toBe("IMPLEMENTATION");
  });

  it("moves to debugging when the latest execution fails", () => {
    const stage = deriveCurrentCodingStage({
      events: [],
      transcripts: [{ speaker: "USER", text: "I think it should work." }],
      latestExecutionRun: { status: "ERROR", stderr: "NameError" },
    });

    expect(stage).toBe("DEBUGGING");
  });

  it("suggests testing and complexity after a passing run", () => {
    const stage = inferSuggestedCodingStage({
      currentStage: "IMPLEMENTATION",
      latestExecutionRun: { status: "PASSED", stdout: "ok" },
      latestUserTurn: "The solution passes the examples.",
      reply: "Nice. What edge cases would you test next, and what are the time and space complexities?",
    });

    expect(stage).toBe("TESTING_AND_COMPLEXITY");
  });
});
