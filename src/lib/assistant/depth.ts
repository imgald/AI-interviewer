import type { SystemDesignStage } from "@/lib/assistant/stages";

export type HandwaveCategory =
  | "unjustified_component_choice"
  | "unquantified_scaling_claim"
  | "tradeoff_evasion";

export type SystemDesignDepthResult = {
  depth: number;
  expectedDepth: number;
  handwave: boolean;
  categories: HandwaveCategory[];
  evidenceRefs: string[];
};

export const EXPECTED_SYSTEM_DESIGN_DEPTH: Record<SystemDesignStage, number> = {
  REQUIREMENTS: 0.3,
  API_CONTRACT_CHECK: 0.45,
  HIGH_LEVEL: 0.5,
  CAPACITY: 0.8,
  DEEP_DIVE: 0.9,
  REFINEMENT: 0.75,
  WRAP_UP: 0.4,
};

export function assessSystemDesignDepth(input: {
  stage: SystemDesignStage;
  recentUserText: string;
  tradeoffMissed: boolean;
}): SystemDesignDepthResult {
  const text = input.recentUserText.toLowerCase();
  const expectedDepth = EXPECTED_SYSTEM_DESIGN_DEPTH[input.stage];

  const hasNumber =
    /\b\d+(?:\.\d+)?\s*(qps|rps|tps|req\/s|requests per second|k|m|b|million|billion|gb|tb|mb|ms|s|users|dau|mau)\b/.test(
      text,
    );
  const hasConstraint =
    /\b(latency|p95|p99|sla|slo|availability|reliability|durability|consistency|security|fault tolerance|cost|throughput)\b/.test(
      text,
    ) || /\b(must|should|cannot|budget|limit|constraint)\b/.test(text);
  const hasCausalChain =
    /\b(because|therefore|so that|which means|given|thus|hence|leads to|as a result)\b/.test(text);

  const depth = Number((Number(hasNumber) * 0.4 + Number(hasConstraint) * 0.3 + Number(hasCausalChain) * 0.3).toFixed(2));
  const handwave = depth < expectedDepth;

  const mentionsScale =
    /\b(scale|scaling|high traffic|throughput|load|millions?|billions?|global|multi-region|partition|shard|replica)\b/.test(
      text,
    );
  const mentionsComponent =
    /\b(cache|queue|partition|shard|replica|gateway|service|database|db|kafka|redis|cdn)\b/.test(text);
  const categories: HandwaveCategory[] = [];

  if (mentionsComponent && !hasCausalChain) {
    categories.push("unjustified_component_choice");
  }
  if (mentionsScale && !hasNumber) {
    categories.push("unquantified_scaling_claim");
  }
  if ((input.stage === "DEEP_DIVE" || input.stage === "REFINEMENT") && input.tradeoffMissed) {
    categories.push("tradeoff_evasion");
  }

  const evidenceRefs = [
    `depth=${depth}, expected=${expectedDepth}, stage=${input.stage}`,
    hasNumber ? "found quantification" : "missing quantification",
    hasConstraint ? "found constraints" : "missing explicit constraints",
    hasCausalChain ? "found causal chain" : "missing causal chain",
  ];

  return {
    depth,
    expectedDepth,
    handwave,
    categories,
    evidenceRefs,
  };
}

