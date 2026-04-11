import { prisma } from "@/lib/db";
import { fail, ok } from "@/lib/http";
import { deriveCurrentCodingStage, deriveCurrentSystemDesignStage } from "@/lib/assistant/stages";
import {
  buildTranscriptVersionIndex,
  decorateTranscriptForRead,
  getCommittedTranscriptSegments,
  summarizeTranscriptTruth,
} from "@/lib/session/commit-arbiter";
import { SESSION_EVENT_TYPES } from "@/lib/session/event-types";
import { resolveLowCostMode, summarizeUsageFromSessionEvents } from "@/lib/usage/cost";

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
      evaluation: {
        include: {
          dimensionScores: true,
        },
      },
      feedbackReport: true,
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

  const transcriptRefinementEvents = await prisma.sessionEvent.findMany({
    where: {
      sessionId: session.id,
      eventType: SESSION_EVENT_TYPES.CANDIDATE_TRANSCRIPT_REFINED,
    },
    orderBy: { eventTime: "asc" },
  });
  const truthEvents = [...session.events, ...transcriptRefinementEvents];
  const transcriptVersionIndex = buildTranscriptVersionIndex(session.transcripts, truthEvents);
  const committedTranscripts = getCommittedTranscriptSegments(session.transcripts, truthEvents);
  const transcriptTruth = summarizeTranscriptTruth(session.transcripts, truthEvents);
  const currentStage =
    session.mode === "SYSTEM_DESIGN"
      ? deriveCurrentSystemDesignStage({
          events: truthEvents,
          transcripts: committedTranscripts,
        })
      : deriveCurrentCodingStage({
          events: truthEvents,
          transcripts: committedTranscripts,
          latestExecutionRun: session.executionRuns[0] ?? null,
        });
  const lowCostMode = resolveLowCostMode(session.events);
  const usageSummary = summarizeUsageFromSessionEvents(session.events);

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
    lowCostMode,
    usageSummary,
    currentStage,
    transcripts: committedTranscripts.map((transcript) =>
      decorateTranscriptForRead(transcript, transcript.id ? transcriptVersionIndex.get(transcript.id) ?? undefined : undefined),
    ),
    transcriptTruth,
    events: session.events,
    evaluation: session.evaluation,
    feedbackReport: session.feedbackReport,
  });
}
