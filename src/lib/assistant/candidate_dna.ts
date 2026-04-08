import type { CandidateSignalSnapshot } from "@/lib/assistant/signal_extractor";

type ExecutionRunLike = {
  status: "PASSED" | "FAILED" | "ERROR" | "TIMEOUT";
};

type MemoryLedgerLike = {
  recentHints: number;
  recentFailedRuns: number;
  repeatedFailurePattern?: string | null;
  unresolvedIssues: string[];
  answeredTargets: string[];
  collectedEvidence: string[];
};

export type CandidateDnaVector = {
  reasoning: number;
  implementation: number;
  coachability: number;
  independence: number;
};

export type CandidateDnaProfile = {
  vector: CandidateDnaVector;
  dominantTraits: string[];
  recommendedMode: "guided" | "balanced" | "challenging";
  rationale: string[];
};

export function assessCandidateDna(input: {
  signals: CandidateSignalSnapshot;
  memory: MemoryLedgerLike;
  latestExecutionRun?: ExecutionRunLike | null;
}): CandidateDnaProfile {
  const { signals, memory, latestExecutionRun } = input;

  const reasoning =
    clamp01(
      scoreFromBand(signals.reasoningDepth, {
        deep: 0.92,
        moderate: 0.68,
        thin: 0.34,
        missing: 0.18,
      }) +
        scoreFromBand(signals.complexityRigor, {
          strong: 0.08,
          partial: 0.03,
          missing: 0,
        }),
    );

  const implementation =
    clamp01(
      scoreFromBand(signals.codeQuality, {
        correct: 0.9,
        partial: 0.62,
        buggy: 0.28,
        missing: 0.12,
      }) +
        (latestExecutionRun?.status === "PASSED"
          ? 0.08
          : latestExecutionRun?.status === "FAILED" || latestExecutionRun?.status === "ERROR" || latestExecutionRun?.status === "TIMEOUT"
            ? -0.05
            : 0),
    );

  const coachability = clamp01(
    0.72 -
      memory.recentHints * 0.08 -
      Math.min(memory.recentFailedRuns, 3) * 0.04 +
      (signals.progress === "progressing" ? 0.08 : signals.progress === "stuck" ? -0.08 : 0),
  );

  const independence = clamp01(
    0.78 -
      memory.recentHints * 0.12 -
      Math.min(memory.recentFailedRuns, 3) * 0.05 -
      (memory.repeatedFailurePattern ? 0.04 : 0) -
      Math.min(memory.unresolvedIssues.length, 3) * 0.03 +
      (signals.readyToCode ? 0.05 : 0) +
      (memory.collectedEvidence.includes("implementation_plan") ? 0.04 : 0) +
      (memory.answeredTargets.includes("complexity") ? 0.03 : 0),
  );

  const vector = {
    reasoning,
    implementation,
    coachability,
    independence,
  };

  const dominantTraits = summarizeTraits(vector);
  const recommendedMode =
    independence < 0.4 ? "guided" : reasoning >= 0.78 && implementation >= 0.7 ? "challenging" : "balanced";
  const rationale = buildRationale(vector, signals, memory);

  return {
    vector,
    dominantTraits,
    recommendedMode,
    rationale,
  };
}

function scoreFromBand(
  value: string | undefined,
  mapping: Record<string, number>,
) {
  return value && value in mapping ? mapping[value] : 0.45;
}

function summarizeTraits(vector: CandidateDnaVector) {
  const traits: string[] = [];

  if (vector.reasoning >= 0.8) {
    traits.push("reasoning-heavy");
  }
  if (vector.implementation >= 0.78) {
    traits.push("strong-executor");
  }
  if (vector.coachability >= 0.72) {
    traits.push("coachable");
  }
  if (vector.independence >= 0.72) {
    traits.push("independent");
  }
  if (vector.independence < 0.4) {
    traits.push("needs-guidance");
  }
  if (traits.length === 0) {
    traits.push("balanced");
  }
  return traits;
}

function buildRationale(
  vector: CandidateDnaVector,
  signals: CandidateSignalSnapshot,
  memory: MemoryLedgerLike,
) {
  const notes: string[] = [];

  notes.push(
    `Reasoning=${vector.reasoning.toFixed(2)}, implementation=${vector.implementation.toFixed(2)}, coachability=${vector.coachability.toFixed(2)}, independence=${vector.independence.toFixed(2)}.`,
  );

  if (signals.reasoningDepth === "deep") {
    notes.push("Deep reasoning signal increased the reasoning axis.");
  }
  if (signals.codeQuality === "correct") {
    notes.push("Correct implementation signal increased the execution axis.");
  }
  if (memory.recentHints > 0) {
    notes.push("Recent hint usage reduced the independence and coachability axes.");
  }
  if (memory.recentFailedRuns > 0) {
    notes.push("Recent failed runs slightly reduced execution confidence.");
  }

  return notes;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}
