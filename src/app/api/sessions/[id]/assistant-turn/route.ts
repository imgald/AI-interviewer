import { prisma } from "@/lib/db";
import { fail, ok } from "@/lib/http";
import { generateAssistantTurn } from "@/lib/assistant/generate-turn";
import { SESSION_EVENT_TYPES } from "@/lib/session/event-types";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_: Request, { params }: RouteContext) {
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
      executionRuns: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!session) {
    return fail("Interview session not found", 404);
  }

  const turn = await generateAssistantTurn({
    mode: session.mode,
    questionTitle: session.question?.title ?? "Coding interview",
    questionPrompt: session.question?.prompt ?? "",
    targetLevel: session.targetLevel,
    selectedLanguage: session.selectedLanguage,
    personaSummary: session.interviewerProfile?.personaSummary ?? null,
    appliedPromptContext: session.interviewerContext?.appliedPromptContext ?? null,
    recentTranscripts: session.transcripts.map((segment) => ({
      speaker: segment.speaker,
      text: segment.text,
    })),
    latestExecutionRun: session.executionRuns[0]
      ? {
          status: session.executionRuns[0].status,
          stdout: session.executionRuns[0].stdout,
          stderr: session.executionRuns[0].stderr,
        }
      : null,
  });

  const lastSegment = session.transcripts.at(-1);
  const segmentIndex = lastSegment ? lastSegment.segmentIndex + 1 : 0;

  const transcript = await prisma.transcriptSegment.create({
    data: {
      sessionId: id,
      speaker: "AI",
      segmentIndex,
      text: turn.reply,
      isFinal: true,
    },
  });

  const events = [];

  const aiSpokeEvent = await prisma.sessionEvent.create({
    data: {
      sessionId: id,
      eventType: SESSION_EVENT_TYPES.AI_SPOKE,
      payloadJson: {
        transcriptSegmentId: transcript.id,
        source: turn.source,
      },
    },
  });
  events.push(aiSpokeEvent);

  if (turn.suggestedStage) {
    const stageEvent = await prisma.sessionEvent.create({
      data: {
        sessionId: id,
        eventType: SESSION_EVENT_TYPES.STAGE_ADVANCED,
        payloadJson: {
          stage: turn.suggestedStage,
          source: turn.source,
        },
      },
    });
    events.push(stageEvent);
  }

  return ok({
    transcript,
    events,
    meta: {
      source: turn.source,
      suggestedStage: turn.suggestedStage ?? null,
    },
  });
}
