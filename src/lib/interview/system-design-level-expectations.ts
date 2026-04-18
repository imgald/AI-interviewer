export type SystemDesignTargetLevel = "NEW_GRAD" | "SDE1" | "SDE2" | "SENIOR" | "STAFF";

export type SystemDesignLevelExpectation = {
  label: string;
  focus: string;
  passBar: string;
  deepDivePressure: "light" | "balanced" | "high" | "very_high";
  mustCover: string[];
};

const LEVEL_EXPECTATIONS: Record<SystemDesignTargetLevel, SystemDesignLevelExpectation> = {
  NEW_GRAD: {
    label: "New Grad",
    focus: "Clarify scope, state reasonable assumptions, and produce a coherent high-level design.",
    passBar: "Can structure requirements and sketch a workable architecture with basic tradeoff awareness.",
    deepDivePressure: "light",
    mustCover: ["functional scope", "non-functional goals", "clear component boundaries"],
  },
  SDE1: {
    label: "SDE1",
    focus: "Solid requirement framing plus practical high-level architecture and basic reliability thinking.",
    passBar: "Needs clear API/data-flow and can justify key component choices.",
    deepDivePressure: "light",
    mustCover: ["scope and API contract", "core data model", "at least one reliability mitigation"],
  },
  SDE2: {
    label: "SDE2",
    focus: "Balanced interview: high-level design quality and targeted deep-dive on one critical path.",
    passBar: "Shows concrete tradeoffs with at least one quantitative estimate connected to design.",
    deepDivePressure: "balanced",
    mustCover: ["capacity estimate", "tradeoff between at least two options", "SPOF or bottleneck mitigation"],
  },
  SENIOR: {
    label: "Senior",
    focus: "Systematically validate scalability and reliability via deeper tradeoff and failure-path analysis.",
    passBar: "Strong deep-dive rigor across bottlenecks, consistency, and operational constraints.",
    deepDivePressure: "high",
    mustCover: ["multi-dimension tradeoffs", "capacity-to-design consistency", "bottleneck mitigation plan"],
  },
  STAFF: {
    label: "Staff",
    focus: "Architectural leadership depth: hard constraints, phased evolution, operational and org-level tradeoffs.",
    passBar: "Demonstrates scalable design judgment under ambiguity with explicit risk management.",
    deepDivePressure: "very_high",
    mustCover: ["explicit assumptions and constraints", "failure-domain strategy", "evolution/rollout plan"],
  },
};

export function getSystemDesignLevelExpectation(level?: string | null): SystemDesignLevelExpectation {
  if (level === "NEW_GRAD" || level === "SDE1" || level === "SDE2" || level === "SENIOR" || level === "STAFF") {
    return LEVEL_EXPECTATIONS[level];
  }
  return LEVEL_EXPECTATIONS.SDE2;
}

