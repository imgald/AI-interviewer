import type { CodingInterviewHintLevel, CodingInterviewHintStyle } from "@/lib/assistant/policy";
import type { PolicyConfig } from "@/lib/assistant/policy-config";
import type { CandidateSignalSnapshot } from "@/lib/assistant/signal_extractor";
import type { CodingInterviewStage } from "@/lib/assistant/stages";
import {
  classifyHintGranularity,
  resolveRescueMode,
  type HintGranularity,
  type RescueMode,
} from "@/lib/assistant/hinting_ledger";

export type HintTier = "L0_NUDGE" | "L1_AREA" | "L2_SPECIFIC" | "L3_SOLUTION";
export type HintInitiator = "candidate_request" | "system_rescue";
export type HintRequestTiming = "early" | "mid" | "late";
export type MomentumAtHint = "productive" | "fragile" | "stalled";

export type HintStrategy = {
  tier: HintTier;
  granularity: HintGranularity;
  rescueMode: RescueMode;
  hintCost: number;
  hintInitiator: HintInitiator;
  hintRequestTiming: HintRequestTiming;
  momentumAtHint: MomentumAtHint;
};

export function resolveHintStrategy(input: {
  currentStage: CodingInterviewStage;
  signals: CandidateSignalSnapshot;
  recentFailedRuns?: number;
  recentEvents?: Array<{ eventType: string; payloadJson?: unknown }>;
  hintStyle?: CodingInterviewHintStyle;
  hintLevel?: CodingInterviewHintLevel;
  policyConfig?: PolicyConfig;
}) {
  const granularity = classifyHintGranularity(input.hintStyle, input.hintLevel);
  const rescueMode = resolveRescueMode({
    currentStage: input.currentStage,
    signals: input.signals,
    recentFailedRuns: input.recentFailedRuns,
    hintStyle: input.hintStyle,
  });

  const uncappedTier = resolveHintTier({
    hintStyle: input.hintStyle,
    hintLevel: input.hintLevel,
    granularity,
  });
  const tier = capHintTier(uncappedTier, input.policyConfig?.hints.maxHintLevel ?? 3);
  const hintInitiator = resolveHintInitiator(input.recentEvents ?? []);
  const hintRequestTiming = resolveHintRequestTiming(input.currentStage);
  const momentumAtHint = resolveMomentumAtHint(input.signals);

  return {
    tier,
    granularity,
    rescueMode,
    hintInitiator,
    hintRequestTiming,
    momentumAtHint,
    hintCost: estimateNonLinearHintCost({
      tier,
      rescueMode,
      hintInitiator,
      hintRequestTiming,
      momentumAtHint,
      policyConfig: input.policyConfig,
    }),
  } satisfies HintStrategy;
}

export function resolveHintTier(input: {
  hintStyle?: CodingInterviewHintStyle;
  hintLevel?: CodingInterviewHintLevel;
  granularity: HintGranularity;
}): HintTier {
  if (input.hintLevel === "LIGHT" && input.granularity === "conceptual") {
    return "L0_NUDGE";
  }
  if (input.granularity === "directional" || input.hintStyle === "TESTING_NUDGE") {
    return "L1_AREA";
  }
  if (input.granularity === "implementation") {
    return "L2_SPECIFIC";
  }
  return "L3_SOLUTION";
}

export function resolveHintInitiator(
  recentEvents: Array<{ eventType: string; payloadJson?: unknown }>,
): HintInitiator {
  const lastHintRequest = [...recentEvents]
    .reverse()
    .find((event) => event.eventType === "HINT_REQUESTED");

  if (!lastHintRequest) {
    return "system_rescue";
  }

  const payload =
    typeof lastHintRequest.payloadJson === "object" && lastHintRequest.payloadJson !== null
      ? (lastHintRequest.payloadJson as Record<string, unknown>)
      : {};
  const source = typeof payload.source === "string" ? payload.source.toLowerCase() : "";

  return source ? "candidate_request" : "system_rescue";
}

export function resolveHintRequestTiming(stage: CodingInterviewStage): HintRequestTiming {
  switch (stage) {
    case "PROBLEM_UNDERSTANDING":
    case "APPROACH_DISCUSSION":
      return "early";
    case "WRAP_UP":
      return "late";
    default:
      return "mid";
  }
}

export function resolveMomentumAtHint(signals: CandidateSignalSnapshot): MomentumAtHint {
  if (signals.progress === "stuck" || signals.codeQuality === "buggy") {
    return "stalled";
  }

  if (signals.progress === "progressing" && signals.behavior === "structured" && signals.confidence >= 0.7) {
    return "productive";
  }

  return "fragile";
}

export function estimateNonLinearHintCost(input: {
  tier: HintTier;
  rescueMode: RescueMode;
  hintInitiator?: HintInitiator;
  hintRequestTiming?: HintRequestTiming;
  momentumAtHint?: MomentumAtHint;
  policyConfig?: PolicyConfig;
}) {
  const base =
    input.tier === "L0_NUDGE"
      ? 0.4
      : input.tier === "L1_AREA"
        ? 1.15
        : input.tier === "L2_SPECIFIC"
          ? 2.8
          : 5.6;
  const rescueMultiplier =
    input.rescueMode === "debug_rescue"
      ? 1.35
      : input.rescueMode === "implementation_rescue"
        ? 1.2
        : input.rescueMode === "conceptual_rescue"
          ? 1.05
          : 1;
  const initiatorMultiplier =
    input.hintInitiator === "candidate_request"
      ? 1.25
      : 0.95;
  const timingMultiplier =
    input.hintRequestTiming === "early"
      ? 1.35
      : input.hintRequestTiming === "late"
        ? 0.9
        : 1;
  const momentumMultiplier =
    input.momentumAtHint === "productive"
      ? 1.2
      : input.momentumAtHint === "fragile"
        ? 1.05
        : 0.9;
  const rescueBiasMultiplier = Number(
    (1 + (0.8 - (input.policyConfig?.hints.rescueModeBias ?? 0.8)) * 0.35).toFixed(2),
  );

  return Number(
    (base * rescueMultiplier * initiatorMultiplier * timingMultiplier * momentumMultiplier * rescueBiasMultiplier).toFixed(
      2,
    ),
  );
}

function capHintTier(tier: HintTier, maxHintLevel: number): HintTier {
  const score = { L0_NUDGE: 0, L1_AREA: 1, L2_SPECIFIC: 2, L3_SOLUTION: 3 } as const;
  const clampedMax = Math.max(0, Math.min(3, maxHintLevel));
  if (score[tier] <= clampedMax) {
    return tier;
  }
  if (clampedMax === 0) {
    return "L0_NUDGE";
  }
  if (clampedMax === 1) {
    return "L1_AREA";
  }
  if (clampedMax === 2) {
    return "L2_SPECIFIC";
  }
  return "L3_SOLUTION";
}
