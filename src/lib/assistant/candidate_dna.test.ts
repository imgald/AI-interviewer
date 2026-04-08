import { describe, expect, it } from "vitest";
import { adaptPolicyToCandidateDna, assessCandidateDna } from "@/lib/assistant/candidate_dna";
import { getPolicyPreset } from "@/lib/assistant/policy-config";

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

  it("adapts the live policy when the DNA recommends guided mode", () => {
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
        confidence: 0.6,
        evidence: [],
        structuredEvidence: [],
        summary: "Candidate needs help staying independent.",
        trendSummary: "Progress has stalled.",
      },
      memory: {
        recentHints: 4,
        recentFailedRuns: 1,
        repeatedFailurePattern: "debugging",
        unresolvedIssues: ["debugging"],
        answeredTargets: [],
        collectedEvidence: [],
      },
      latestExecutionRun: { status: "FAILED" },
    });

    const adapted = adaptPolicyToCandidateDna(getPolicyPreset("bar_raiser"), profile);
    expect(adapted.policyMode).toBe("guided");
    expect(adapted.policyConfig.intentBias.guide).toBeGreaterThan(getPolicyPreset("bar_raiser").intentBias.guide);
    expect(adapted.policyConfig.intentBias.pressure).toBeLessThan(getPolicyPreset("bar_raiser").intentBias.pressure);
  });

  it("adapts the live policy when the DNA recommends challenging mode", () => {
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
        confidence: 0.93,
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

    const adapted = adaptPolicyToCandidateDna(getPolicyPreset("collaborative"), profile);
    expect(adapted.policyMode).toBe("challenging");
    expect(adapted.policyConfig.intentBias.probe).toBeGreaterThan(getPolicyPreset("collaborative").intentBias.probe);
    expect(adapted.policyConfig.hints.maxHintLevel).toBeLessThanOrEqual(getPolicyPreset("collaborative").hints.maxHintLevel);
  });
});
