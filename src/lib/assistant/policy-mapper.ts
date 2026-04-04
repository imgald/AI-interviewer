import { getPolicyPreset, type PolicyArchetype, type PolicyConfig } from "@/lib/assistant/policy-config";

export type PersonaPolicyInput = {
  personaSummary?: string | null;
  appliedPromptContext?: string | null;
};

export function mapPersonaToPolicy(input: PersonaPolicyInput): PolicyConfig {
  const personaText = `${input.personaSummary ?? ""} ${input.appliedPromptContext ?? ""}`.toLowerCase();
  return getPolicyPreset(inferArchetype(personaText));
}

function inferArchetype(text: string): PolicyArchetype {
  if (!text.trim()) {
    return "collaborative";
  }

  const hasGoogleLikeSignals =
    /\b(google|collaborative|thoughtful|clarity|structured reasoning|pair|guide|coaching)\b/.test(text) ||
    /\blikely focus areas:.*(clarity|communication)\b/.test(text);
  if (hasGoogleLikeSignals) {
    return "collaborative";
  }

  const hasAmazonLikeSignals =
    /\b(amazon|bar raiser|direct|detail-oriented|tradeoff|leadership|high bar|ownership)\b/.test(text) ||
    /\blikely focus areas:.*(tradeoffs|complexity|correctness)\b/.test(text);
  if (hasAmazonLikeSignals) {
    return "bar_raiser";
  }

  const hasEducatorSignals =
    /\b(mentor|teacher|educator|teaching|explain|pedagogical|coaching)\b/.test(text);
  if (hasEducatorSignals) {
    return "educator";
  }

  const hasSpeedSignals =
    /\b(speed|fast|rapid|time pressure|efficient interviewing|concise)\b/.test(text);
  if (hasSpeedSignals) {
    return "speed_demon";
  }

  return "collaborative";
}
