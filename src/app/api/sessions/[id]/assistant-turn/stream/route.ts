import { prisma } from "@/lib/db";
import { fail } from "@/lib/http";
import { streamAssistantTurn } from "@/lib/assistant/generate-turn";
import { deriveCurrentCodingStage } from "@/lib/assistant/stages";
import { SESSION_EVENT_TYPES } from "@/lib/session/event-types";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: RouteContext) {
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
      events: {
        orderBy: { eventTime: "asc" },
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

  const input = {
    mode: session.mode,
    questionTitle: session.question?.title ?? "Coding interview",
    questionPrompt: session.question?.prompt ?? "",
    targetLevel: session.targetLevel,
    selectedLanguage: session.selectedLanguage,
    personaSummary: session.interviewerProfile?.personaSummary ?? null,
    appliedPromptContext: session.interviewerContext?.appliedPromptContext ?? null,
    currentStage,
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
  };

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        let finalTurn:
          | {
              reply: string;
              suggestedStage?: string;
              source: "fallback" | "openai" | "gemini";
            }
          | undefined;

        for await (const chunk of streamAssistantTurn(input, { signal: request.signal })) {
          if (request.signal.aborted) {
            controller.close();
            return;
          }

          if (chunk.textDelta) {
            controller.enqueue(encoder.encode(`event: delta\ndata: ${JSON.stringify({ text: chunk.textDelta })}\n\n`));
          }

          if (chunk.final) {
            finalTurn = chunk.final;
          }
        }

        if (!finalTurn || request.signal.aborted) {
          controller.close();
          return;
        }

        const lastSegment = session.transcripts.at(-1);
        const segmentIndex = lastSegment ? lastSegment.segmentIndex + 1 : 0;

        const transcript = await prisma.transcriptSegment.create({
          data: {
            sessionId: id,
            speaker: "AI",
            segmentIndex,
            text: finalTurn.reply,
            isFinal: true,
          },
        });

        const events: Array<{
          id: string;
          eventType: string;
          eventTime?: Date;
          payloadJson?: unknown;
        }> = [];

        const aiSpokeEvent = await prisma.sessionEvent.create({
          data: {
            sessionId: id,
            eventType: SESSION_EVENT_TYPES.AI_SPOKE,
            payloadJson: {
              transcriptSegmentId: transcript.id,
              source: finalTurn.source,
            },
          },
        });
        events.push(aiSpokeEvent);

        if (finalTurn.suggestedStage && finalTurn.suggestedStage !== currentStage) {
          const stageEvent = await prisma.sessionEvent.create({
            data: {
              sessionId: id,
              eventType: SESSION_EVENT_TYPES.STAGE_ADVANCED,
              payloadJson: {
                previousStage: currentStage,
                stage: finalTurn.suggestedStage,
                source: finalTurn.source,
              },
            },
          });
          events.push(stageEvent);
        }

        controller.enqueue(
          encoder.encode(
            `event: done\ndata: ${JSON.stringify({
              transcript,
              events,
              meta: {
                source: finalTurn.source,
                currentStage,
                suggestedStage: finalTurn.suggestedStage ?? null,
              },
            })}\n\n`,
          ),
        );
        controller.close();
      } catch (error) {
        controller.enqueue(
          encoder.encode(
            `event: error\ndata: ${JSON.stringify({
              message: error instanceof Error ? error.message : "Assistant streaming failed.",
            })}\n\n`,
          ),
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
