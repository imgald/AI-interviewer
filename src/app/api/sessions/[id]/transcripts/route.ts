import { prisma } from "@/lib/db";
import { fail, ok } from "@/lib/http";
import {
  buildTranscriptVersionIndex,
  decorateTranscriptForRead,
  deriveTranscriptCommitState,
} from "@/lib/session/commit-arbiter";
import { SESSION_EVENT_TYPES } from "@/lib/session/event-types";
import { enforceMutationGuard } from "@/lib/security/request-guard";
import { createTranscriptSegmentSchema } from "@/schemas/session-runtime";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, { params }: RouteContext) {
  const { id } = await params;

  const session = await prisma.interviewSession.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!session) {
    return fail("Interview session not found", 404);
  }

  const transcripts = await prisma.transcriptSegment.findMany({
    where: { sessionId: id },
    orderBy: { segmentIndex: "asc" },
  });
  const transcriptEvents = await prisma.sessionEvent.findMany({
    where: {
      sessionId: id,
      eventType: SESSION_EVENT_TYPES.CANDIDATE_TRANSCRIPT_REFINED,
    },
    orderBy: { eventTime: "asc" },
  });
  const versionIndex = buildTranscriptVersionIndex(transcripts, transcriptEvents);

  return ok({
    transcripts: transcripts.map((transcript) => {
      const metadata = transcript.id ? versionIndex.get(transcript.id) : null;
      return decorateTranscriptForRead(transcript, {
        correctionOfId: metadata?.correctionOfId ?? null,
        transcriptVersion: metadata?.transcriptVersion ?? 1,
        supersededById: metadata?.supersededById ?? null,
      });
    }),
  });
}

export async function POST(request: Request, { params }: RouteContext) {
  const guarded = enforceMutationGuard(request, "transcript_write");
  if (guarded) {
    return guarded;
  }
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = createTranscriptSegmentSchema.safeParse(body);

  if (!parsed.success) {
    return fail("Invalid request body", 400, {
      issues: parsed.error.flatten(),
    });
  }

  const session = await prisma.interviewSession.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!session) {
    return fail("Interview session not found", 404);
  }

  const lastSegment = await prisma.transcriptSegment.findFirst({
    where: { sessionId: id },
    orderBy: { segmentIndex: "desc" },
    select: { segmentIndex: true },
  });

  const segment = await prisma.transcriptSegment.create({
    data: {
      sessionId: id,
      speaker: parsed.data.speaker,
      segmentIndex: (lastSegment?.segmentIndex ?? -1) + 1,
      text: parsed.data.text,
      startedAtMs: parsed.data.startedAtMs,
      endedAtMs: parsed.data.endedAtMs,
      isFinal: parsed.data.isFinal,
      audioUrl: parsed.data.audioUrl,
    },
  });

  await prisma.sessionEvent.create({
    data: {
      sessionId: id,
      eventType:
        parsed.data.speaker === "USER"
          ? SESSION_EVENT_TYPES.CANDIDATE_SPOKE
          : parsed.data.speaker === "AI"
            ? SESSION_EVENT_TYPES.AI_SPOKE
            : "TRANSCRIPT_SEGMENT_ADDED",
      payloadJson: {
        speaker: parsed.data.speaker,
        transcriptSegmentId: segment.id,
        isFinal: parsed.data.isFinal,
        commitState: deriveTranscriptCommitState({ isFinal: parsed.data.isFinal }),
        correctionOfId: parsed.data.correctionOfId ?? null,
        transcriptSource: parsed.data.transcriptSource ?? null,
        transcriptProvider: parsed.data.transcriptProvider ?? null,
      },
    },
  });

  let transcriptVersion = 1;
  if (parsed.data.correctionOfId) {
    const existingTranscripts = await prisma.transcriptSegment.findMany({
      where: { sessionId: id },
      orderBy: { segmentIndex: "asc" },
    });
    const transcriptEvents = await prisma.sessionEvent.findMany({
      where: {
        sessionId: id,
        eventType: SESSION_EVENT_TYPES.CANDIDATE_TRANSCRIPT_REFINED,
      },
      orderBy: { eventTime: "asc" },
    });
    const versionIndex = buildTranscriptVersionIndex(existingTranscripts, transcriptEvents);
    transcriptVersion = (versionIndex.get(parsed.data.correctionOfId)?.transcriptVersion ?? 1) + 1;
  }

  if (
    parsed.data.speaker === "USER" &&
    (parsed.data.correctionOfId ||
      (parsed.data.transcriptSource !== undefined &&
        parsed.data.transcriptSource !== "browser" &&
        parsed.data.transcriptSource !== "manual" &&
        parsed.data.transcriptSource !== "assistant" &&
        parsed.data.sourceText &&
        parsed.data.sourceText.trim() !== parsed.data.text.trim()))
  ) {
    await prisma.sessionEvent.create({
      data: {
        sessionId: id,
        eventType: SESSION_EVENT_TYPES.CANDIDATE_TRANSCRIPT_REFINED,
        payloadJson: {
          transcriptSegmentId: segment.id,
          correctionOfId: parsed.data.correctionOfId ?? null,
          transcriptVersion,
          transcriptProvider: parsed.data.transcriptProvider ?? parsed.data.transcriptSource,
          originalText: parsed.data.sourceText ?? null,
          refinedText: parsed.data.text,
        },
      },
    });
  }

  return ok(
    {
      transcript: decorateTranscriptForRead(segment, {
        correctionOfId: parsed.data.correctionOfId ?? null,
        transcriptVersion,
      }),
    },
    { status: 201 },
  );
}

