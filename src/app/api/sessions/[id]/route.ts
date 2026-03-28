import { prisma } from "@/lib/db";
import { fail, ok } from "@/lib/http";
import { deriveCurrentCodingStage } from "@/lib/assistant/stages";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, { params }: RouteContext) {
  const { id } = await params;

  const session = await prisma.interviewSession.findUnique({
    where: { id },
    include: {
      question: true,
      interviewerContext: true,
      interviewerProfile: true,
      transcripts: {
        orderBy: { segmentIndex: "asc" },
      },
      events: {
        orderBy: { eventTime: "desc" },
        take: 25,
      },
      executionRuns: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!session) {
    return fail("Interview session not found", 404);
  }

  const currentStage = deriveCurrentCodingStage({
    events: session.events,
    transcripts: session.transcripts,
    latestExecutionRun: session.executionRuns[0] ?? null,
  });

  return ok({
    id: session.id,
    mode: session.mode,
    status: session.status,
    targetLevel: session.targetLevel,
    selectedLanguage: session.selectedLanguage,
    voiceEnabled: session.voiceEnabled,
    personaEnabled: session.personaEnabled,
    question: session.question,
    interviewerProfile: session.interviewerProfile,
    interviewerContext: session.interviewerContext,
    currentStage,
    transcripts: session.transcripts,
    events: session.events,
  });
}
