import type { InterviewerProfile, Prisma } from "@prisma/client";

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export type PersonaSnapshot = Prisma.InputJsonObject & {
  interviewerName: string | null;
  seniorityEstimate: string | null;
  technicalFocus: Prisma.InputJsonArray;
  likelyInterviewFocus: Prisma.InputJsonArray;
  communicationStyleGuess: Prisma.InputJsonArray;
  confidence: number | null;
  sourceUrl: string;
};

export function buildPersonaSnapshot(profile: InterviewerProfile): PersonaSnapshot {
  return {
    interviewerName: profile.fullName ?? null,
    seniorityEstimate: profile.seniorityEstimate ?? null,
    technicalFocus: asStringArray(profile.technicalFocus),
    likelyInterviewFocus: asStringArray(profile.likelyInterviewFocus),
    communicationStyleGuess: asStringArray(profile.communicationStyleGuess),
    confidence: profile.confidence ?? null,
    sourceUrl: profile.sourceUrl,
  };
}

export function buildAppliedPromptContext(snapshot: PersonaSnapshot) {
  return [
    "Use the provided public interviewer profile only as a soft bias.",
    `Likely focus areas: ${JSON.stringify(snapshot.likelyInterviewFocus)}.`,
    `Technical areas: ${JSON.stringify(snapshot.technicalFocus)}.`,
    `Communication style hints: ${JSON.stringify(snapshot.communicationStyleGuess)}.`,
    "Do not claim certainty about the real interviewer.",
    "Do not infer or mention sensitive personal attributes.",
  ].join(" ");
}
