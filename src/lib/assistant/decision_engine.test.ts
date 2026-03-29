import { describe, expect, it } from "vitest";
import { makeCandidateDecision } from "@/lib/assistant/decision_engine";
import type { CandidateSignalSnapshot } from "@/lib/assistant/signal_extractor";

const baseSignals: CandidateSignalSnapshot = {
  understanding: "clear",
  progress: "progressing",
  communication: "clear",
  codeQuality: "partial",
  algorithmChoice: "reasonable",
  edgeCaseAwareness: "partial",
  behavior: "structured",
  reasoningDepth: "moderate",
  testingDiscipline: "partial",
  complexityRigor: "partial",
  confidence: 0.76,
  evidence: ["Candidate explained the approach clearly."],
  summary: "Understanding is clear and progress is progressing.",
  trendSummary: "Candidate state is broadly stable relative to the previous snapshot.",
};

const basePolicy = {
  currentStage: "IMPLEMENTATION",
  recommendedAction: "LET_IMPLEMENT",
  shouldServeHint: false,
  nextStage: "IMPLEMENTATION",
  exitCriteria: ["Keep coding"],
  checklist: [],
  checklistProgress: { completed: 0, total: 0, remaining: 0 },
  explanation: "Continue implementation.",
} as const;

describe("makeCandidateDecision", () => {
  it("forces a narrow debug move after repeated failures", () => {
    const result = makeCandidateDecision({
      currentStage: "IMPLEMENTATION",
      policy: basePolicy,
      signals: {
        ...baseSignals,
        progress: "stuck",
        codeQuality: "buggy",
      },
      recentEvents: [
        { eventType: "CODE_RUN_COMPLETED", payloadJson: { status: "FAILED" } },
        { eventType: "CODE_RUN_COMPLETED", payloadJson: { status: "ERROR" } },
      ],
      latestExecutionRun: { status: "ERROR", stderr: "IndexError" },
    });

    expect(result.action).toBe("ask_for_debug_plan");
    expect(result.target).toBe("debugging");
    expect(result.suggestedStage).toBe("DEBUGGING");
  });

  it("pushes on tradeoffs when understanding is clear but algorithm choice is weak", () => {
    const result = makeCandidateDecision({
      currentStage: "APPROACH_DISCUSSION",
      policy: {
        ...basePolicy,
        currentStage: "APPROACH_DISCUSSION",
        nextStage: "APPROACH_DISCUSSION",
        recommendedAction: "PROBE_APPROACH",
      },
      signals: {
        ...baseSignals,
        algorithmChoice: "suboptimal",
      },
    });

    expect(result.action).toBe("probe_tradeoff");
    expect(result.target).toBe("tradeoff");
    expect(result.question).toMatch(/runtime|efficient|alternative|tradeoff/i);
  });

  it("holds the floor for the candidate when implementation is progressing in a structured way", () => {
    const result = makeCandidateDecision({
      currentStage: "IMPLEMENTATION",
      policy: basePolicy,
      signals: {
        ...baseSignals,
        progress: "progressing",
        behavior: "structured",
      },
      recentEvents: [
        { eventType: "CANDIDATE_SPOKE" },
        { eventType: "AI_SPOKE" },
        { eventType: "CANDIDATE_SPOKE" },
      ],
    });

    expect(result.action).toBe("hold_and_listen");
    expect(result.target).toBe("implementation");
  });

  it("probes correctness when the code looks close but the reasoning is still thin", () => {
    const result = makeCandidateDecision({
      currentStage: "IMPLEMENTATION",
      policy: basePolicy,
      signals: {
        ...baseSignals,
        codeQuality: "correct",
        reasoningDepth: "thin",
      },
      latestExecutionRun: { status: "PASSED" },
    });

    expect(result.action).toBe("probe_correctness");
    expect(result.target).toBe("correctness");
    expect(result.question).toMatch(/correct|invariant|concrete example/i);
  });

  it("asks for edge cases when implementation is complete but validation is thin", () => {
    const result = makeCandidateDecision({
      currentStage: "IMPLEMENTATION",
      policy: basePolicy,
      signals: {
        ...baseSignals,
        codeQuality: "correct",
        edgeCaseAwareness: "missing",
      },
      latestExecutionRun: { status: "PASSED" },
    });

    expect(result.action).toBe("ask_for_test_case");
    expect(result.target).toBe("edge_case");
    expect(result.suggestedStage).toBe("TESTING_AND_COMPLEXITY");
  });

  it("pushes for explicit reasoning when the candidate names an approach without enough explanation", () => {
    const result = makeCandidateDecision({
      currentStage: "APPROACH_DISCUSSION",
      policy: {
        ...basePolicy,
        currentStage: "APPROACH_DISCUSSION",
        nextStage: "APPROACH_DISCUSSION",
        recommendedAction: "PROBE_APPROACH",
      },
      signals: {
        ...baseSignals,
        reasoningDepth: "thin",
      },
    });

    expect(result.action).toBe("ask_for_reasoning");
    expect(result.target).toBe("reasoning");
    expect(result.question).toMatch(/why does this approach work|invariant|concrete example/i);
  });

  it("asks for complexity rigor before wrap-up when testing is covered but complexity is still weak", () => {
    const result = makeCandidateDecision({
      currentStage: "TESTING_AND_COMPLEXITY",
      policy: {
        ...basePolicy,
        currentStage: "TESTING_AND_COMPLEXITY",
        nextStage: "WRAP_UP",
        recommendedAction: "VALIDATE_AND_TEST",
      },
      signals: {
        ...baseSignals,
        edgeCaseAwareness: "present",
        testingDiscipline: "strong",
        complexityRigor: "missing",
      },
    });

    expect(result.action).toBe("ask_for_complexity");
    expect(result.question).toMatch(/time and space complexity|tradeoff/i);
  });

  it("moves faster into implementation when the candidate-state trend is clearly improving", () => {
    const result = makeCandidateDecision({
      currentStage: "APPROACH_DISCUSSION",
      policy: {
        ...basePolicy,
        currentStage: "APPROACH_DISCUSSION",
        nextStage: "APPROACH_DISCUSSION",
        recommendedAction: "PROBE_APPROACH",
      },
      signals: {
        ...baseSignals,
        trendSummary: "Recent state trend: progress moved from stuck to progressing; testing discipline moved from missing to partial.",
      },
    });

    expect(result.action).toBe("encourage_and_continue");
    expect(result.suggestedStage).toBe("IMPLEMENTATION");
  });

  it("forces a tighter implementation follow-up when the candidate-state trend is getting worse", () => {
    const result = makeCandidateDecision({
      currentStage: "IMPLEMENTATION",
      policy: basePolicy,
      signals: {
        ...baseSignals,
        trendSummary: "Recent state trend: progress moved from progressing to stuck; code quality changed from correct to buggy.",
      },
    });

    expect(result.action).toBe("ask_followup");
    expect(result.target).toBe("implementation");
    expect(result.question).toMatch(/state update|branch|tiny input/i);
  });
});
