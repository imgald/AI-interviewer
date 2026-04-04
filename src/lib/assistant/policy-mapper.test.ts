import { describe, expect, it } from "vitest";
import { mapPersonaToPolicy } from "@/lib/assistant/policy-mapper";

describe("mapPersonaToPolicy", () => {
  it("maps tradeoff-heavy direct personas to the bar raiser preset", () => {
    const policy = mapPersonaToPolicy({
      personaSummary: "A senior interviewer with a direct, detail-oriented style.",
      appliedPromptContext: 'Likely focus areas: ["tradeoffs","complexity"]. Communication style hints: ["direct"].',
    });

    expect(policy.archetype).toBe("bar_raiser");
    expect(policy.intentBias.probe).toBeGreaterThan(policy.intentBias.guide);
  });

  it("maps clarity- and coaching-oriented personas to the collaborative preset", () => {
    const policy = mapPersonaToPolicy({
      personaSummary: "A thoughtful interviewer who values clarity and collaborative problem solving.",
      appliedPromptContext: 'Likely focus areas: ["communication","clarity"]. Communication style hints: ["thoughtful"].',
    });

    expect(policy.archetype).toBe("collaborative");
    expect(policy.pacing.preferLetRun).toBeGreaterThan(0.7);
  });
});
