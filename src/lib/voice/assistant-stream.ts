type ResolveAssistantSpeechRemainderInput = {
  streamedDraft: string;
  finalTranscriptText?: string | null;
  spokenIndex: number;
};

export function resolveAuthoritativeAssistantReply(input: {
  streamedDraft: string;
  finalTranscriptText?: string | null;
}) {
  const finalText = normalizeAssistantText(input.finalTranscriptText);
  if (finalText) {
    return finalText;
  }

  return normalizeAssistantText(input.streamedDraft);
}

export function resolveAssistantSpeechRemainder(input: ResolveAssistantSpeechRemainderInput) {
  const authoritative = resolveAuthoritativeAssistantReply(input);
  if (!authoritative) {
    return "";
  }

  const spokenPrefix = normalizeAssistantText(input.streamedDraft.slice(0, input.spokenIndex));
  if (!spokenPrefix) {
    return authoritative;
  }

  if (startsWithIgnoreCase(authoritative, spokenPrefix)) {
    return authoritative.slice(spokenPrefix.length).trim();
  }

  return "";
}

function normalizeAssistantText(text: string | null | undefined) {
  return typeof text === "string" ? text.trim().replace(/\s+/g, " ") : "";
}

function startsWithIgnoreCase(text: string, prefix: string) {
  return text.toLowerCase().startsWith(prefix.toLowerCase());
}
