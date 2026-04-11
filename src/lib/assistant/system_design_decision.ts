import type { CandidateDecision } from "@/lib/assistant/decision_engine";
import type { CodingInterviewPolicyAction, SystemDesignPolicyAction } from "@/lib/assistant/policy";
import type { CandidateSignalSnapshot } from "@/lib/assistant/signal_extractor";
import type { SystemDesignStage } from "@/lib/assistant/stages";

export type SystemDesignDecision = CandidateDecision & {
  systemDesignActionType: SystemDesignPolicyAction;
};

export function makeSystemDesignDecision(input: {
  currentStage: SystemDesignStage;
  signals: CandidateSignalSnapshot;
}): SystemDesignDecision {
  const designSignals = input.signals.designSignals?.signals ?? {
    requirement_missing: true,
    capacity_missing: true,
    tradeoff_missed: true,
    spof_missed: true,
    bottleneck_unexamined: true,
  };

  const scores = [
    score("ASK_REQUIREMENT", input.currentStage, designSignals),
    score("ASK_CAPACITY", input.currentStage, designSignals),
    score("PROBE_TRADEOFF", input.currentStage, designSignals),
    score("CHALLENGE_SPOF", input.currentStage, designSignals),
    score("ZOOM_IN", input.currentStage, designSignals),
    score("WRAP_UP", input.currentStage, designSignals),
  ].sort((left, right) => right.totalScore - left.totalScore);

  return toDecision(scores[0]?.actionType ?? "ASK_REQUIREMENT", scores);
}

function score(
  actionType: SystemDesignPolicyAction,
  stage: SystemDesignStage,
  signals: NonNullable<CandidateSignalSnapshot["designSignals"]>["signals"],
) {
  let need = 0;
  let timing = 0;
  let value = 0;
  let closure = 0;
  let policy = 0;

  switch (actionType) {
    case "ASK_REQUIREMENT":
      need = signals.requirement_missing || stage === "REQUIREMENTS" ? 0.95 : -0.2;
      timing = stage === "REQUIREMENTS" ? 0.85 : -0.05;
      value = signals.requirement_missing ? 0.92 : -0.15;
      closure = stage === "WRAP_UP" ? -0.3 : 0.1;
      policy = 0.08;
      break;
    case "ASK_CAPACITY":
      need = signals.capacity_missing ? 0.9 : -0.15;
      timing = stage === "CAPACITY" ? 0.88 : stage === "HIGH_LEVEL" ? 0.28 : -0.05;
      value = signals.capacity_missing ? 0.86 : -0.1;
      closure = stage === "WRAP_UP" ? -0.3 : 0.08;
      policy = signals.capacity_missing && stage === "CAPACITY" ? 0.65 : 0.05;
      break;
    case "PROBE_TRADEOFF":
      need = signals.tradeoff_missed ? 0.88 : -0.12;
      timing = stage === "DEEP_DIVE" || stage === "REFINEMENT" ? 0.7 : 0.2;
      value = signals.tradeoff_missed ? 0.85 : 0.2;
      closure = stage === "WRAP_UP" ? -0.25 : 0.08;
      policy = signals.tradeoff_missed ? 0.5 : 0.02;
      break;
    case "CHALLENGE_SPOF":
      need = signals.spof_missed ? 0.9 : -0.15;
      timing = stage === "DEEP_DIVE" || stage === "REFINEMENT" ? 0.74 : 0.18;
      value = signals.spof_missed ? 0.88 : 0.15;
      closure = stage === "WRAP_UP" ? -0.25 : 0.08;
      policy = signals.spof_missed ? 0.58 : 0.02;
      break;
    case "ZOOM_IN":
      need = signals.bottleneck_unexamined ? 0.84 : 0.25;
      timing = stage === "DEEP_DIVE" || stage === "REFINEMENT" ? 0.72 : 0.2;
      value = signals.bottleneck_unexamined ? 0.82 : 0.4;
      closure = stage === "WRAP_UP" ? -0.22 : 0.1;
      policy = signals.bottleneck_unexamined ? 0.52 : 0.04;
      break;
    case "WRAP_UP":
      need = stage === "WRAP_UP" ? 0.8 : -0.45;
      timing = stage === "WRAP_UP" ? 0.9 : -0.35;
      value = Object.values(signals).every((missing) => !missing) ? 0.75 : -0.35;
      closure = Object.values(signals).every((missing) => !missing) || stage === "WRAP_UP" ? 0.9 : -0.6;
      policy = 0.03;
      break;
  }

  const reasons = [
    { key: "need", magnitude: need, kind: "signal" as const, detail: "Need score from unresolved system-design evidence." },
    { key: "timing", magnitude: timing, kind: "signal" as const, detail: "Timing score from the current system-design stage." },
    { key: "value", magnitude: value, kind: "signal" as const, detail: "Value score from expected evidence gain." },
    { key: "closure", magnitude: closure, kind: "signal" as const, detail: "Closure score from stage readiness." },
    { key: "policy", magnitude: policy, kind: "signal" as const, detail: "Policy bias toward missing must-have signals." },
  ];
  const totalScore = Number(reasons.reduce((sum, item) => sum + item.magnitude, 0).toFixed(3));

  return {
    actionType,
    reasons,
    totalScore,
  };
}

function toDecision(
  actionType: SystemDesignPolicyAction,
  scores: Array<{
    actionType: SystemDesignPolicyAction;
    reasons: Array<{ key: string; magnitude: number; kind: "signal"; detail: string }>;
    totalScore: number;
  }>,
): SystemDesignDecision {
  const common = {
    confidence: 0.86,
    reason: `System design argmax selected ${actionType}.`,
    scoreBreakdown: scores[0]?.reasons ?? [],
    candidateScores: [],
    totalScore: scores[0]?.totalScore ?? 0,
    systemDesignActionType: actionType,
  };

  switch (actionType) {
    case "ASK_REQUIREMENT":
      return {
        ...common,
        action: "ask_for_clarification",
        target: "understanding",
        question:
          "Before we continue, clarify requirements: core functional scope, expected scale (for example QPS/traffic), and top non-functional goals.",
        policyAction: "CLARIFY",
      };
    case "ASK_CAPACITY":
      return {
        ...common,
        action: "ask_followup",
        target: "approach",
        question:
          "Quantify one concrete capacity estimate first (traffic or data), then explain how it changes your architecture choices.",
        policyAction: "PROBE_APPROACH",
      };
    case "PROBE_TRADEOFF":
      return {
        ...common,
        action: "probe_tradeoff",
        target: "tradeoff",
        question:
          "Compare two realistic design options, state pros/cons, and justify which tradeoff you pick.",
        policyAction: "PROBE_APPROACH",
      };
    case "CHALLENGE_SPOF":
      return {
        ...common,
        action: "ask_followup",
        target: "correctness",
        question:
          "What is the biggest single point of failure in your design, and what mitigation would you add?",
        policyAction: "PROBE_APPROACH",
      };
    case "ZOOM_IN":
      return {
        ...common,
        action: "ask_followup",
        target: "approach",
        question:
          "Zoom in on one bottleneck in your design and walk through your optimization plan plus tradeoff.",
        policyAction: "PROBE_APPROACH",
      };
    case "WRAP_UP":
      return {
        ...common,
        action: "move_to_wrap_up",
        target: "summary",
        question:
          "Give a concise final design summary: key components, major tradeoff, reliability posture, and one next improvement.",
        suggestedStage: "WRAP_UP",
        policyAction: "WRAP_UP",
      };
  }
}

export function mapSystemDesignActionToPolicyAction(actionType: SystemDesignPolicyAction): CodingInterviewPolicyAction {
  switch (actionType) {
    case "ASK_REQUIREMENT":
      return "CLARIFY";
    case "ASK_CAPACITY":
    case "PROBE_TRADEOFF":
    case "CHALLENGE_SPOF":
    case "ZOOM_IN":
      return "PROBE_APPROACH";
    case "WRAP_UP":
      return "WRAP_UP";
  }
}
