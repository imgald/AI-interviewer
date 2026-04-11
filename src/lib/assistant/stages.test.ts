import { describe, expect, it } from "vitest";
import {
  deriveCurrentCodingStage,
  deriveCurrentSystemDesignStage,
  inferSuggestedCodingStage,
  inferSystemDesignStage,
} from "@/lib/assistant/stages";

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

  it("infers system design capacity stage when requirements are present but estimates are missing", () => {
    const stage = inferSystemDesignStage({
      transcripts: [
        {
          speaker: "USER",
          text: "We need upload/download APIs for global traffic with 99.9% availability and low latency.",
        },
      ],
    });

    expect(stage).toBe("API_CONTRACT_CHECK");
  });

  it("infers system design capacity only after architecture/scaling context is active", () => {
    const stage = inferSystemDesignStage({
      transcripts: [
        {
          speaker: "USER",
          text: "We need APIs for global traffic with p99 latency and high availability. GET /items and POST /items are the core endpoints.",
        },
        {
          speaker: "USER",
          text: "High level architecture has api gateway, services, queue, cache, and sharded database components. We should scale with replicas and partitioning.",
        },
      ],
    });

    expect(stage).toBe("CAPACITY");
  });

  it("derives system design stage from latest explicit transition", () => {
    const stage = deriveCurrentSystemDesignStage({
      events: [
        {
          eventType: "STAGE_ADVANCED",
          eventTime: "2026-04-11T00:00:00.000Z",
          payloadJson: { stage: "CAPACITY" },
        },
        {
          eventType: "STAGE_ADVANCED",
          eventTime: "2026-04-11T00:01:00.000Z",
          payloadJson: { stage: "HIGH_LEVEL" },
        },
      ],
      transcripts: [],
    });

    expect(stage).toBe("HIGH_LEVEL");
  });
});
