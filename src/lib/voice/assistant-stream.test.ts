import { describe, expect, it } from "vitest";
import {
  resolveAuthoritativeAssistantReply,
  resolveAssistantSpeechRemainder,
} from "@/lib/voice/assistant-stream";

describe("assistant stream voice locking", () => {
  it("prefers the final transcript text as the authoritative reply", () => {
    expect(
      resolveAuthoritativeAssistantReply({
        streamedDraft: "Which high-risk boundary condition would you test next?",
        finalTranscriptText: "Give me one concise final wrap-up, then we will close this question.",
      }),
    ).toBe("Give me one concise final wrap-up, then we will close this question.");
  });

  it("speaks the remaining authoritative tail when the final reply preserves the spoken prefix", () => {
    const streamedDraft = "Please implement the main loop and then walk me through one edge case.";
    const spokenPrefix = "Please implement the main loop";

    expect(
      resolveAssistantSpeechRemainder({
        streamedDraft,
        finalTranscriptText: "Please implement the main loop, then walk me through one edge case.",
        spokenIndex: spokenPrefix.length,
      }),
    ).toBe(", then walk me through one edge case.");
  });

  it("suppresses the remaining tail when the final reply no longer matches the spoken prefix", () => {
    const streamedDraft = "Which high-risk boundary condition would you test next?";
    const spokenPrefix = "Which high-risk boundary condition";

    expect(
      resolveAssistantSpeechRemainder({
        streamedDraft,
        finalTranscriptText: "Give me one concise final wrap-up, then we will close this question.",
        spokenIndex: spokenPrefix.length,
      }),
    ).toBe("");
  });
});
