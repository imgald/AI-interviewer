export type PolicyArchetype = "bar_raiser" | "collaborative" | "speed_demon" | "educator";

export interface PolicyIntentBias extends Record<string, number> {
  validate: number;
  probe: number;
  guide: number;
  pressure: number;
  unblock: number;
  close: number;
}

export interface PolicyPressureSchedule extends Record<string, string> {
  initial: "soft" | "neutral";
  clarification: "soft" | "neutral" | "challenging";
  coding: "neutral" | "challenging";
  testing: "neutral" | "surgical";
  wrapUp: "soft" | "neutral";
}

export interface PolicyThresholds extends Record<string, number> {
  stuckTurnLimit: number;
  interruptionCostMin: number;
  evidenceSaturation: number;
}

export interface PolicyPacingConfig extends Record<string, number> {
  preferLetRun: number;
  closeTopicAggression: number;
  moveToImplementationBias: number;
}

export interface PolicyHintsConfig extends Record<string, number> {
  delayFactor: number;
  maxHintLevel: number;
  rescueModeBias: number;
}

export interface PolicyConfig extends Record<string, unknown> {
  archetype: PolicyArchetype;
  intentBias: PolicyIntentBias;
  pressureSchedule: PolicyPressureSchedule;
  thresholds: PolicyThresholds;
  pacing: PolicyPacingConfig;
  hints: PolicyHintsConfig;
}

export const POLICY_PRESETS: Record<PolicyArchetype, PolicyConfig> = {
  bar_raiser: {
    archetype: "bar_raiser",
    intentBias: { validate: 0.8, probe: 1, guide: 0.35, pressure: 0.9, unblock: 0.45, close: 0.55 },
    pressureSchedule: {
      initial: "neutral",
      clarification: "challenging",
      coding: "challenging",
      testing: "surgical",
      wrapUp: "neutral",
    },
    thresholds: {
      stuckTurnLimit: 2,
      interruptionCostMin: 2,
      evidenceSaturation: 3,
    },
    pacing: {
      preferLetRun: 0.35,
      closeTopicAggression: 0.75,
      moveToImplementationBias: 0.45,
    },
    hints: {
      delayFactor: 1.2,
      maxHintLevel: 1,
      rescueModeBias: 0.3,
    },
  },
  collaborative: {
    archetype: "collaborative",
    intentBias: { validate: 0.55, probe: 0.6, guide: 0.9, pressure: 0.35, unblock: 0.85, close: 0.5 },
    pressureSchedule: {
      initial: "soft",
      clarification: "neutral",
      coding: "neutral",
      testing: "neutral",
      wrapUp: "soft",
    },
    thresholds: {
      stuckTurnLimit: 3,
      interruptionCostMin: 3,
      evidenceSaturation: 3,
    },
    pacing: {
      preferLetRun: 0.8,
      closeTopicAggression: 0.45,
      moveToImplementationBias: 0.85,
    },
    hints: {
      delayFactor: 0.8,
      maxHintLevel: 2,
      rescueModeBias: 0.75,
    },
  },
  speed_demon: {
    archetype: "speed_demon",
    intentBias: { validate: 0.45, probe: 0.55, guide: 0.35, pressure: 0.7, unblock: 0.25, close: 1 },
    pressureSchedule: {
      initial: "neutral",
      clarification: "neutral",
      coding: "challenging",
      testing: "surgical",
      wrapUp: "neutral",
    },
    thresholds: {
      stuckTurnLimit: 2,
      interruptionCostMin: 2,
      evidenceSaturation: 2,
    },
    pacing: {
      preferLetRun: 0.55,
      closeTopicAggression: 0.95,
      moveToImplementationBias: 0.9,
    },
    hints: {
      delayFactor: 1.3,
      maxHintLevel: 1,
      rescueModeBias: 0.2,
    },
  },
  educator: {
    archetype: "educator",
    intentBias: { validate: 0.55, probe: 0.4, guide: 1, pressure: 0.2, unblock: 0.95, close: 0.4 },
    pressureSchedule: {
      initial: "soft",
      clarification: "soft",
      coding: "neutral",
      testing: "neutral",
      wrapUp: "soft",
    },
    thresholds: {
      stuckTurnLimit: 3,
      interruptionCostMin: 3,
      evidenceSaturation: 4,
    },
    pacing: {
      preferLetRun: 0.7,
      closeTopicAggression: 0.35,
      moveToImplementationBias: 0.75,
    },
    hints: {
      delayFactor: 0.7,
      maxHintLevel: 3,
      rescueModeBias: 0.95,
    },
  },
};

export function getPolicyPreset(archetype: PolicyArchetype): PolicyConfig {
  return POLICY_PRESETS[archetype];
}
