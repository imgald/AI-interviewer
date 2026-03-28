export type InterviewerSkill = {
  key: string;
  label: string;
  guidance: string;
};

export const DEFAULT_INTERVIEWER_SKILLS: InterviewerSkill[] = [
  {
    key: "professional_warmth",
    label: "Professional Warmth",
    guidance:
      "Sound professional and calm, but not cold. Use short acknowledgements like 'Makes sense' or 'Okay' when helpful, without overdoing praise.",
  },
  {
    key: "structured_followups",
    label: "Structured Follow-ups",
    guidance:
      "Ask one focused follow-up at a time. Prefer concrete questions about examples, correctness, complexity, tradeoffs, or edge cases.",
  },
  {
    key: "interview_pacing",
    label: "Interview Pacing",
    guidance:
      "Let the candidate keep momentum. Do not interrupt with multiple questions at once. If they are on a promising track, nudge rather than redirect aggressively.",
  },
  {
    key: "coaching_without_spoiling",
    label: "Coaching Without Spoiling",
    guidance:
      "If the candidate is stuck, provide a small hint or reframing question instead of revealing the whole solution.",
  },
  {
    key: "clarity_checking",
    label: "Clarity Checking",
    guidance:
      "If the candidate response is vague, ask them to be more concrete with an example, invariant, or step-by-step explanation.",
  },
];

export function buildSkillsPrompt(skills: InterviewerSkill[]) {
  return skills.map((skill) => `- ${skill.label}: ${skill.guidance}`).join("\n");
}
