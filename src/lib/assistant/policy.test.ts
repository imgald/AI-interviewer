import { describe, expect, it } from "vitest";
import { enforceSystemDesignNoCodeInvariant, resolveCodingInterviewPolicy } from "@/lib/assistant/policy";
import { generateSessionReport } from "@/lib/evaluation/report";

describe("coding interview policy", () => {
  it("moves a passing implementation run into testing and complexity", () => {
    const policy = resolveCodingInterviewPolicy({
      currentStage: "IMPLEMENTATION",
      recentTranscripts: [{ speaker: "USER", text: "The main loop and pointer updates are in place, and the code is ready to run." }],
      latestExecutionRun: { status: "PASSED", stdout: "ok" },
    });

    expect(policy.recommendedAction).toBe("VALIDATE_AND_TEST");
    expect(policy.nextStage).toBe("TESTING_AND_COMPLEXITY");
    expect(policy.checklist[0]?.satisfied).toBe(true);
  });

  it("serves a stage-aware hint when the candidate recently requested one", () => {
    const policy = resolveCodingInterviewPolicy({
      currentStage: "APPROACH_DISCUSSION",
      recentTranscripts: [{ speaker: "USER", text: "I am not sure which direction is best." }],
      recentEvents: [
        {
          eventType: "HINT_REQUESTED",
          eventTime: "2026-03-28T00:01:00.000Z",
        },
      ],
      latestExecutionRun: null,
    });

    expect(policy.shouldServeHint).toBe(true);
    expect(policy.hintStyle).toBe("APPROACH_NUDGE");
    expect(policy.recommendedAction).toBe("SERVE_HINT");
    expect(policy.hintLevel).toBe("MEDIUM");
    expect(policy.escalationReason).toBe("explicit_hint_request");
  });

  it("keeps problem understanding active until constraints or an approach are clear", () => {
    const policy = resolveCodingInterviewPolicy({
      currentStage: "PROBLEM_UNDERSTANDING",
      recentTranscripts: [{ speaker: "USER", text: "Can I assume the input fits in memory, and if we had an empty array the output would just be no match?" }],
      latestExecutionRun: null,
    });

    expect(policy.stageExitSatisfied).toBe(true);
    expect(policy.nextStage).toBe("APPROACH_DISCUSSION");
    expect(policy.checklist.every((item) => item.satisfied)).toBe(true);
  });

  it("builds a lightweight session report from current interview signals", () => {
    const report = generateSessionReport({
      sessionId: "session-1",
      questionTitle: "Merge Intervals",
      targetLevel: "SDE2",
      selectedLanguage: "PYTHON",
      transcripts: [
        { speaker: "USER", text: "I would first clarify the constraints and then sort the intervals." },
        { speaker: "AI", text: "Walk me through a concrete example." },
        { speaker: "USER", text: "After sorting, I merge while scanning once. The time complexity is O(n log n)." },
      ],
      events: [
        { eventType: "STAGE_ADVANCED", payloadJson: { stage: "APPROACH_DISCUSSION" } },
        { eventType: "STAGE_ADVANCED", payloadJson: { stage: "IMPLEMENTATION" } },
        { eventType: "STAGE_ADVANCED", payloadJson: { stage: "TESTING_AND_COMPLEXITY" } },
      ],
      executionRuns: [{ status: "PASSED", stdout: "ok", stderr: "", runtimeMs: 14 }],
    });

    expect(report.overallScore).toBeGreaterThan(0);
    expect(report.dimensions).toHaveLength(6);
    expect(report.reportJson).toHaveProperty("stageJourney");
  });

  it("escalates hint strength after repeated failed runs in debugging", () => {
    const policy = resolveCodingInterviewPolicy({
      currentStage: "DEBUGGING",
      recentTranscripts: [{ speaker: "USER", text: "I am still stuck and not sure which branch is wrong." }],
      recentEvents: [
        { eventType: "CODE_RUN_COMPLETED", payloadJson: { status: "FAILED" }, eventTime: "2026-03-28T00:00:00.000Z" },
        { eventType: "CODE_RUN_COMPLETED", payloadJson: { status: "ERROR" }, eventTime: "2026-03-28T00:01:00.000Z" },
      ],
      latestExecutionRun: { status: "FAILED", stderr: "IndexError" },
    });

    expect(policy.shouldServeHint).toBe(true);
    expect(policy.hintLevel).toBe("STRONG");
    expect(policy.escalationReason).toBe("multiple_recent_failures");
  });

  it("enforces no-code invariant in system design mode", () => {
    const guarded = enforceSystemDesignNoCodeInvariant({
      mode: "SYSTEM_DESIGN",
      action: "move_stage",
      target: "implementation",
      question: "Please implement the write path and run tests.",
    });

    expect(guarded.action).toBe("ask_followup");
    expect(guarded.target).toBe("approach");
    expect(guarded.question).toMatch(/design level|tradeoff|reliability/i);
  });

  it("does not alter coding mode actions", () => {
    const guarded = enforceSystemDesignNoCodeInvariant({
      mode: "CODING",
      action: "move_stage",
      target: "implementation",
      question: "Please implement the write path and run tests.",
    });

    expect(guarded.action).toBe("move_stage");
    expect(guarded.target).toBe("implementation");
  });
});

