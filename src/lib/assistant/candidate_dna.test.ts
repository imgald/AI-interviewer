import { describe, expect, it } from "vitest";
import { assessCandidateDna } from "@/lib/assistant/candidate_dna";

describe("assessCandidateDna", () => {
  it("recommends guided mode when independence is low", () => {
    const profile = assessCandidateDna({
      signals: {
        understanding: "clear",
        progress: "stuck",
        communication: "clear",
        codeQuality: "partial",
        algorithmChoice: "reasonable",
        edgeCaseAwareness: "partial",
        behavior: "structured",
        readyToCode: false,
        reasoningDepth: "moderate",
        testingDiscipline: "partial",
        complexityRigor: "partial",
        confidence: 0.52,
        evidence: [],
        structuredEvidence: [],
        summary: "Candidate is stuck.",
        trendSummary: "Progress has stalled.",
      },
      memory: {
        recentHints: 4,
        recentFailedRuns: 2,
        repeatedFailurePattern: "index",
        unresolvedIssues: ["debugging"],
        answeredTargets: [],
        collectedEvidence: [],
      },
      latestExecutionRun: { status: "FAILED" },
    });

    expect(profile.recommendedMode).toBe("guided");
    expect(profile.vector.independence).toBeLessThan(0.4);
  });

  it("recommends challenging mode for a strong, independent candidate", () => {
    const profile = assessCandidateDna({
      signals: {
        understanding: "clear",
        progress: "progressing",
        communication: "clear",
        codeQuality: "correct",
        algorithmChoice: "strong",
        edgeCaseAwareness: "present",
        behavior: "structured",
        readyToCode: true,
        reasoningDepth: "deep",
        testingDiscipline: "strong",
        complexityRigor: "strong",
        confidence: 0.9,
        evidence: [],
        structuredEvidence: [],
        summary: "Candidate is strong and independent.",
        trendSummary: "Signal quality is consistently strong.",
      },
      memory: {
        recentHints: 0,
        recentFailedRuns: 0,
        repeatedFailurePattern: null,
        unresolvedIssues: [],
        answeredTargets: ["complexity"],
        collectedEvidence: ["implementation_plan"],
      },
      latestExecutionRun: { status: "PASSED" },
    });

    expect(profile.recommendedMode).toBe("challenging");
    expect(profile.dominantTraits).toContain("independent");
    expect(profile.vector.reasoning).toBeGreaterThan(0.8);
  });
});
