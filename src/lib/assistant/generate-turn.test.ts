import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generateAssistantTurn } from "@/lib/assistant/generate-turn";

describe("generateAssistantTurn", () => {
  const originalGeminiKey = process.env.GEMINI_API_KEY;
  const originalOpenAiKey = process.env.OPENAI_API_KEY;
  const originalProvider = process.env.LLM_PROVIDER;

  beforeEach(() => {
    process.env.GEMINI_API_KEY = "";
    process.env.OPENAI_API_KEY = "";
    process.env.LLM_PROVIDER = "fallback";
  });

  afterEach(() => {
    process.env.GEMINI_API_KEY = originalGeminiKey;
    process.env.OPENAI_API_KEY = originalOpenAiKey;
    process.env.LLM_PROVIDER = originalProvider;
  });

  it("opens the interview when no conversation exists", async () => {
    const result = await generateAssistantTurn({
      mode: "CODING",
      questionTitle: "Merge Intervals",
      questionPrompt: "Merge overlapping intervals.",
      recentTranscripts: [],
    });

    expect(result.source).toBe("fallback");
    expect(result.reply).toMatch(/first-pass approach|restate/i);
  });

  it("asks about debugging after an execution error", async () => {
    const result = await generateAssistantTurn({
      mode: "CODING",
      questionTitle: "Merge Intervals",
      questionPrompt: "Merge overlapping intervals.",
      recentTranscripts: [{ speaker: "USER", text: "I think the code should work." }],
      latestExecutionRun: {
        status: "ERROR",
        stderr: "NameError",
      },
    });

    expect(result.source).toBe("fallback");
    expect(result.reply).toMatch(/causing it|debug/i);
    expect(result.suggestedStage).toBe("DEBUGGING");
  });

  it("falls back locally when no provider key is configured", async () => {
    const result = await generateAssistantTurn({
      mode: "CODING",
      questionTitle: "Top K Frequent Elements",
      questionPrompt: "Return the k most frequent elements.",
      recentTranscripts: [{ speaker: "USER", text: "I think a hash map would help." }],
    });

    expect(result.source).toBe("fallback");
    expect(result.reply).toMatch(/concrete example/i);
  });

  it("asks for more specificity when the candidate reply is too short", async () => {
    const result = await generateAssistantTurn({
      mode: "CODING",
      questionTitle: "Top K Frequent Elements",
      questionPrompt: "Return the k most frequent elements.",
      recentTranscripts: [{ speaker: "USER", text: "Maybe sorting?" }],
    });

    expect(result.source).toBe("fallback");
    expect(result.reply).toMatch(/concrete|example|exactly/i);
  });

  it("varies the wording if the previous AI turn was the same follow-up", async () => {
    const result = await generateAssistantTurn({
      mode: "CODING",
      questionTitle: "Top K Frequent Elements",
      questionPrompt: "Return the k most frequent elements.",
      recentTranscripts: [
        {
          speaker: "AI",
          text: "That sounds like a reasonable direction. Walk me through one concrete example and then tell me the expected time and space complexity.",
        },
        {
          speaker: "USER",
          text: "I would use a hash map first and then maybe sort by frequency.",
        },
      ],
    });

    expect(result.source).toBe("fallback");
    expect(result.reply).not.toBe(
      "That sounds like a reasonable direction. Walk me through one concrete example and then tell me the expected time and space complexity.",
    );
  });

  it("returns a complete sentence ending", async () => {
    const result = await generateAssistantTurn({
      mode: "CODING",
      questionTitle: "Top K Frequent Elements",
      questionPrompt: "Return the k most frequent elements.",
      recentTranscripts: [{ speaker: "USER", text: "I am not sure." }],
    });

    expect(/[.!?]["']?$/.test(result.reply)).toBe(true);
  });
});
