export type TranscriptCommitState = "PENDING" | "COMMITTED";

export type CommitArbiterTranscript = {
  id?: string;
  speaker: "USER" | "AI" | "SYSTEM";
  text: string;
  segmentIndex: number;
  isFinal?: boolean | null;
};

export type CommitArbiterEvent = {
  eventType: string;
  payloadJson?: unknown;
};

export type TranscriptVersionMetadata = {
  correctionOfId: string | null;
  transcriptVersion: number;
  supersededById: string | null;
};

export type TranscriptTruthSummary = {
  totalSegments: number;
  pendingCount: number;
  committedCount: number;
  activeCommittedCount: number;
  supersededCount: number;
  versionedCount: number;
};

export function deriveTranscriptCommitState(
  transcript: Pick<CommitArbiterTranscript, "isFinal">,
): TranscriptCommitState {
  return transcript.isFinal === false ? "PENDING" : "COMMITTED";
}

export function isCommittedTranscript(
  transcript: Pick<CommitArbiterTranscript, "isFinal">,
): boolean {
  return deriveTranscriptCommitState(transcript) === "COMMITTED";
}

export function getCommittedTranscriptSegments<
  T extends Pick<CommitArbiterTranscript, "id" | "isFinal" | "segmentIndex">
>(
  transcripts: T[],
  events?: CommitArbiterEvent[],
): T[] {
  const versionIndex = buildTranscriptVersionIndex(transcripts, events);

  return transcripts.filter((transcript) => {
    if (!isCommittedTranscript(transcript)) {
      return false;
    }

    if (!transcript.id) {
      return true;
    }

    return !versionIndex.get(transcript.id)?.supersededById;
  });
}

export function decorateTranscriptForRead<T extends CommitArbiterTranscript>(
  transcript: T,
  extras?: {
    correctionOfId?: string | null;
    transcriptVersion?: number;
    supersededById?: string | null;
  },
) {
  return {
    ...transcript,
    commitState: deriveTranscriptCommitState(transcript),
    correctionOfId: extras?.correctionOfId ?? null,
    transcriptVersion: extras?.transcriptVersion ?? 1,
    supersededById: extras?.supersededById ?? null,
  };
}

function parseCorrectionPayload(payloadJson: unknown): {
  transcriptSegmentId: string | null;
  correctionOfId: string | null;
} {
  if (!payloadJson || typeof payloadJson !== "object") {
    return {
      transcriptSegmentId: null,
      correctionOfId: null,
    };
  }

  const payload = payloadJson as Record<string, unknown>;
  return {
    transcriptSegmentId:
      typeof payload.transcriptSegmentId === "string" && payload.transcriptSegmentId.trim().length > 0
        ? payload.transcriptSegmentId
        : null,
    correctionOfId:
      typeof payload.correctionOfId === "string" && payload.correctionOfId.trim().length > 0
        ? payload.correctionOfId
        : null,
  };
}

export function buildTranscriptVersionIndex<T extends Pick<CommitArbiterTranscript, "id" | "segmentIndex">>(
  transcripts: T[],
  events?: CommitArbiterEvent[],
): Map<string, TranscriptVersionMetadata> {
  const sortedTranscripts = [...transcripts].sort((left, right) => left.segmentIndex - right.segmentIndex);
  const metadata = new Map<string, TranscriptVersionMetadata>();

  for (const transcript of sortedTranscripts) {
    if (!transcript.id) {
      continue;
    }

    metadata.set(transcript.id, {
      correctionOfId: null,
      transcriptVersion: 1,
      supersededById: null,
    });
  }

  for (const event of events ?? []) {
    const { transcriptSegmentId, correctionOfId } = parseCorrectionPayload(event.payloadJson);
    if (!transcriptSegmentId) {
      continue;
    }

    const current = metadata.get(transcriptSegmentId);
    if (!current) {
      continue;
    }

    if (!correctionOfId) {
      metadata.set(transcriptSegmentId, {
        ...current,
        correctionOfId: null,
      });
      continue;
    }

    const previous = metadata.get(correctionOfId);
    const nextVersion = previous ? previous.transcriptVersion + 1 : Math.max(current.transcriptVersion, 2);

    metadata.set(transcriptSegmentId, {
      correctionOfId,
      transcriptVersion: nextVersion,
      supersededById: current.supersededById,
    });

    if (previous) {
      metadata.set(correctionOfId, {
        ...previous,
        supersededById: transcriptSegmentId,
      });
    }
  }

  return metadata;
}

export function summarizeTranscriptTruth<T extends CommitArbiterTranscript>(
  transcripts: T[],
  events?: CommitArbiterEvent[],
): TranscriptTruthSummary {
  const versionIndex = buildTranscriptVersionIndex(transcripts, events);
  let pendingCount = 0;
  let committedCount = 0;
  let activeCommittedCount = 0;
  let supersededCount = 0;
  let versionedCount = 0;

  for (const transcript of transcripts) {
    const commitState = deriveTranscriptCommitState(transcript);
    if (commitState === "PENDING") {
      pendingCount += 1;
      continue;
    }

    committedCount += 1;
    const metadata = transcript.id ? versionIndex.get(transcript.id) : null;
    if (metadata?.correctionOfId) {
      versionedCount += 1;
    }
    if (metadata?.supersededById) {
      supersededCount += 1;
      continue;
    }
    activeCommittedCount += 1;
  }

  return {
    totalSegments: transcripts.length,
    pendingCount,
    committedCount,
    activeCommittedCount,
    supersededCount,
    versionedCount,
  };
}
