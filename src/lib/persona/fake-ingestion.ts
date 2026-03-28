import { prisma } from "@/lib/db";

const sampleProfiles: Record<string, {
  fullName: string;
  currentRole: string;
  currentCompany: string;
  personaSummary: string;
  technicalFocus: string[];
  likelyInterviewFocus: string[];
  communicationStyleGuess: string[];
  seniorityEstimate: string;
  confidence: number;
}> = {
  GITHUB: {
    fullName: "Public GitHub Profile",
    currentRole: "Software Engineer",
    currentCompany: "Unknown",
    personaSummary: "Public coding profile suggests an engineer who may value implementation clarity, testing habits, and pragmatic tradeoff discussion.",
    technicalFocus: ["coding", "code quality", "developer tooling"],
    likelyInterviewFocus: ["edge cases", "correctness", "code clarity"],
    communicationStyleGuess: ["practical", "implementation-focused"],
    seniorityEstimate: "mid",
    confidence: 0.55,
  },
  BLOG: {
    fullName: "Technical Author",
    currentRole: "Engineer / Writer",
    currentCompany: "Unknown",
    personaSummary: "Public writing suggests an interviewer who may care about clarity of explanation and structured reasoning.",
    technicalFocus: ["system design", "architecture", "technical communication"],
    likelyInterviewFocus: ["tradeoffs", "clarity", "structured problem solving"],
    communicationStyleGuess: ["direct", "thoughtful"],
    seniorityEstimate: "senior",
    confidence: 0.61,
  },
  default: {
    fullName: "Public Profile",
    currentRole: "Software Engineer",
    currentCompany: "Unknown",
    personaSummary: "Public profile suggests a technically oriented interviewer with an emphasis on structured thinking, tradeoffs, and clarity.",
    technicalFocus: ["backend", "problem solving", "software engineering"],
    likelyInterviewFocus: ["complexity analysis", "tradeoffs", "communication"],
    communicationStyleGuess: ["direct", "detail-oriented"],
    seniorityEstimate: "senior",
    confidence: 0.58,
  },
};

type IngestionScenario = "success" | "retry-once" | "always-fail";

function getScenario(sourceUrl: string): IngestionScenario {
  const normalized = sourceUrl.toLowerCase();

  if (normalized.includes("always-fail") || normalized.includes("hard-fail") || normalized.includes("blocked")) {
    return "always-fail";
  }

  if (normalized.includes("retry") || normalized.includes("flaky") || normalized.includes("timeout")) {
    return "retry-once";
  }

  return "success";
}

export async function runFakePersonaIngestion(interviewerProfileId: string, attemptNumber: number) {
  const profile = await prisma.interviewerProfile.findUnique({
    where: { id: interviewerProfileId },
  });

  if (!profile) {
    return;
  }

  await prisma.interviewerProfile.update({
    where: { id: interviewerProfileId },
    data: {
      status: "PROCESSING",
      fetchStatus: "FETCHING",
    },
  });

  // Simulate a small amount of real worker time so the queue path is observable in the UI.
  await new Promise((resolve) => setTimeout(resolve, 1200));

  const scenario = getScenario(profile.sourceUrl);

  if (scenario === "retry-once" && attemptNumber === 1) {
    throw new Error("Temporary fetch timeout while reading the public profile. Retrying automatically.");
  }

  if (scenario === "always-fail") {
    throw new Error("Public profile could not be extracted reliably. Falling back to generic interviewer mode.");
  }

  const sample = sampleProfiles[profile.sourceType] ?? sampleProfiles.default;

  await prisma.interviewerProfile.update({
    where: { id: interviewerProfileId },
    data: {
      fullName: sample.fullName,
      currentRole: sample.currentRole,
      currentCompany: sample.currentCompany,
      personaSummary: sample.personaSummary,
      technicalFocus: sample.technicalFocus,
      likelyInterviewFocus: sample.likelyInterviewFocus,
      communicationStyleGuess: sample.communicationStyleGuess,
      seniorityEstimate: sample.seniorityEstimate,
      confidence: sample.confidence,
      bioSummary: `Synthesized from public source: ${profile.sourceUrl}`,
      status: "READY",
      fetchStatus: "SUCCEEDED",
      fetchedAt: new Date(),
      sources: {
        updateMany: {
          where: { interviewerProfileId },
          data: {
            fetchStatus: "SUCCEEDED",
            fetchedAt: new Date(),
            rawTextExcerpt: "Stub public profile extraction for MVP scaffolding.",
            normalizedContent: "This is a placeholder extracted profile summary for local development.",
          },
        },
      },
    },
  });
}
