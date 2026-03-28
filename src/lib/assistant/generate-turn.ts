import { buildSkillsPrompt, DEFAULT_INTERVIEWER_SKILLS } from "@/lib/assistant/interviewer-skills";

type TranscriptLike = {
  speaker: "USER" | "AI" | "SYSTEM";
  text: string;
};

type ExecutionRunLike = {
  status: "PASSED" | "FAILED" | "ERROR" | "TIMEOUT";
  stdout?: string | null;
  stderr?: string | null;
};

type GenerateAssistantTurnInput = {
  mode: string;
  questionTitle: string;
  questionPrompt: string;
  targetLevel?: string | null;
  selectedLanguage?: string | null;
  personaSummary?: string | null;
  appliedPromptContext?: string | null;
  recentTranscripts: TranscriptLike[];
  latestExecutionRun?: ExecutionRunLike | null;
};

type GenerateAssistantTurnResult = {
  reply: string;
  suggestedStage?: string;
  source: "fallback" | "openai" | "gemini";
};

export async function generateAssistantTurn(
  input: GenerateAssistantTurnInput,
): Promise<GenerateAssistantTurnResult> {
  const provider = resolveProvider();

  if (provider === "gemini" && process.env.GEMINI_API_KEY) {
    try {
      const reply = await generateWithGemini(input);
      if (reply) {
        return reply;
      }
    } catch {
      // Fall back to lower-priority providers or local heuristics.
    }
  }

  if ((provider === "openai" || process.env.OPENAI_API_KEY) && process.env.OPENAI_API_KEY) {
    try {
      const reply = await generateWithOpenAI(input);
      if (reply) {
        return reply;
      }
    } catch {
      // Fall back to local heuristics to keep the room usable even if the model call fails.
    }
  }

  return generateFallbackTurn(input);
}

function resolveProvider() {
  const preferred = process.env.LLM_PROVIDER?.trim().toLowerCase();
  if (preferred === "gemini" || preferred === "openai" || preferred === "fallback") {
    return preferred;
  }

  if (process.env.GEMINI_API_KEY) {
    return "gemini";
  }

  if (process.env.OPENAI_API_KEY) {
    return "openai";
  }

  return "fallback";
}

async function generateWithOpenAI(
  input: GenerateAssistantTurnInput,
): Promise<GenerateAssistantTurnResult | null> {
  const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
  const prompt = buildInterviewerPrompt(input);

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: buildSystemPrompt() }],
        },
        {
          role: "user",
          content: [{ type: "input_text", text: prompt }],
        },
      ],
    }),
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    output_text?: string;
  };

  const reply = payload.output_text?.trim();
  if (!reply) {
    return null;
  }

  return {
    reply: finalizeReply(reply),
    suggestedStage: inferStage(reply),
    source: "openai",
  };
}

async function generateWithGemini(
  input: GenerateAssistantTurnInput,
): Promise<GenerateAssistantTurnResult | null> {
  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY ?? "",
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: buildSystemPrompt() }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: buildInterviewerPrompt(input) }],
          },
        ],
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens: 320,
        },
      }),
    },
  );

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string;
        }>;
      };
    }>;
  };

  const reply = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
  if (!reply) {
    return null;
  }

  return {
    reply: finalizeReply(reply),
    suggestedStage: inferStage(reply),
    source: "gemini",
  };
}

function buildSystemPrompt() {
  return [
    "You are a North American SDE coding interviewer.",
    "Keep replies concise, natural, and interview-like.",
    "Sound like a thoughtful human interviewer rather than a chatbot.",
    "Ask one focused follow-up question at a time.",
    "Do not reveal full solutions unless the candidate explicitly asks for a hint.",
    "If the candidate mentions an approach, probe correctness, edge cases, complexity, or tradeoffs.",
    "Use basic interview etiquette: calm tone, clear transitions, and respectful pacing.",
    "Avoid repeating the exact same follow-up wording from your last turn.",
    "Return plain text only.",
    "Interviewer skills:\n" + buildSkillsPrompt(DEFAULT_INTERVIEWER_SKILLS),
  ].join(" ");
}

function buildInterviewerPrompt(input: GenerateAssistantTurnInput) {
  const recentTurns = input.recentTranscripts
    .slice(-6)
    .map((item) => `${item.speaker}: ${item.text}`)
    .join("\n");

  return [
    `Mode: ${input.mode}`,
    `Question: ${input.questionTitle}`,
    `Prompt: ${input.questionPrompt}`,
    `Target level: ${input.targetLevel ?? "unspecified"}`,
    `Language: ${input.selectedLanguage ?? "unspecified"}`,
    `Persona summary: ${input.personaSummary ?? "generic interviewer"}`,
    `Applied prompt context: ${input.appliedPromptContext ?? "none"}`,
    input.latestExecutionRun
      ? `Latest code run: ${input.latestExecutionRun.status}. stdout=${truncate(input.latestExecutionRun.stdout ?? "", 180)} stderr=${truncate(input.latestExecutionRun.stderr ?? "", 180)}`
      : "Latest code run: none",
    `Latest AI turn: ${findLatestTurn(input.recentTranscripts, "AI") ?? "none"}`,
    `Latest user turn: ${findLatestTurn(input.recentTranscripts, "USER") ?? "none"}`,
    `Recent conversation:\n${recentTurns || "No turns yet."}`,
    "Write the interviewer's next single reply.",
    "Do not repeat the previous AI sentence verbatim.",
  ].join("\n\n");
}

function generateFallbackTurn(input: GenerateAssistantTurnInput): GenerateAssistantTurnResult {
  const latestUserTurn = [...input.recentTranscripts].reverse().find((item) => item.speaker === "USER");
  const latestAiTurn = [...input.recentTranscripts].reverse().find((item) => item.speaker === "AI");
  const latestRun = input.latestExecutionRun;

  if (!latestUserTurn && !latestAiTurn) {
    return {
      reply: `Let's get started with ${input.questionTitle}. Before you code, could you restate the problem in your own words and walk me through your initial approach?`,
      suggestedStage: "PROBLEM_UNDERSTANDING",
      source: "fallback",
    };
  }

  if (latestRun?.status === "ERROR") {
    return {
      reply: withVariation(
        "I see the latest run hit an error. What do you think is causing it, and how would you debug it before changing the implementation?",
        latestAiTurn?.text,
        "Looks like the latest run failed. Where would you inspect first, and what specific bug do you suspect?",
      ),
      suggestedStage: "DEBUGGING",
      source: "fallback",
    };
  }

  if (latestRun?.status === "TIMEOUT") {
    return {
      reply: withVariation(
        "The latest run timed out. Can you reason about the time complexity and what part of the implementation might be doing more work than expected?",
        latestAiTurn?.text,
        "The timeout is a useful signal. Which step of your solution is likely dominating the runtime, and how would you tighten it up?",
      ),
      suggestedStage: "COMPLEXITY_DISCUSSION",
      source: "fallback",
    };
  }

  if (latestRun?.status === "PASSED") {
    return {
      reply: withVariation(
        "Your latest run completed successfully. Before we move on, what edge cases would you test next, and what are the time and space complexities?",
        latestAiTurn?.text,
        "Nice, that run completed. What edge cases are still worth checking, and how would you describe the final time and space complexity?",
      ),
      suggestedStage: "TESTING_AND_COMPLEXITY",
      source: "fallback",
    };
  }

  const latestUserText = latestUserTurn?.text.toLowerCase() ?? "";
  const wordCount = latestUserText.split(/\s+/).filter(Boolean).length;

  if (latestUserText.includes("stuck") || latestUserText.includes("not sure") || latestUserText.includes("don't know")) {
    return {
      reply: withVariation(
        "Let's narrow it down. What data structure would help you look up or group information quickly here, and why?",
        latestAiTurn?.text,
        "No problem. If you simplify the problem first, what data structure seems most useful, and what would it buy you?",
      ),
      suggestedStage: "HINTING",
      source: "fallback",
    };
  }

  if (wordCount <= 5) {
    return {
      reply: withVariation(
        "Could you make that a bit more concrete? Walk me through the steps on one small example.",
        latestAiTurn?.text,
        "Say a little more about that. Pick one example input and narrate exactly what your algorithm would do.",
      ),
      suggestedStage: "APPROACH_DISCUSSION",
      source: "fallback",
    };
  }

  if (
    latestUserText.includes("hash map") ||
    latestUserText.includes("dictionary") ||
    latestUserText.includes("two pointers") ||
    latestUserText.includes("sort")
  ) {
    return {
      reply: withVariation(
        "That sounds like a reasonable direction. Walk me through one concrete example and then tell me the expected time and space complexity.",
        latestAiTurn?.text,
        "Okay, that direction makes sense. Can you step through one example and explain why the data structure choice helps?",
      ),
      suggestedStage: "APPROACH_DISCUSSION",
      source: "fallback",
    };
  }

  if (latestUserText.includes("complexity") || latestUserText.includes("o(")) {
    return {
      reply: withVariation(
        "Good. Now think about correctness: what invariants or edge cases would you use to convince yourself this approach is safe?",
        latestAiTurn?.text,
        "That covers complexity. Now help me believe the solution is correct: what invariant or edge case would you use to validate it?",
      ),
      suggestedStage: "CORRECTNESS_DISCUSSION",
      source: "fallback",
    };
  }

  if (latestUserText.includes("edge case") || latestUserText.includes("empty") || latestUserText.includes("duplicate")) {
    return {
      reply: withVariation(
        "Good catch. How would your implementation handle that case, and do you need to change anything in the core logic?",
        latestAiTurn?.text,
        "That's a useful edge case. Would your current implementation already handle it, or would you adjust the logic?",
      ),
      suggestedStage: "CORRECTNESS_DISCUSSION",
      source: "fallback",
    };
  }

  return {
    reply: withVariation(
      "Keep going. Explain your approach step by step, and make sure you call out assumptions, edge cases, and the tradeoff behind your design choice.",
      latestAiTurn?.text,
      "You're heading in a reasonable direction. Keep walking me through it step by step, and be explicit about assumptions and tradeoffs.",
    ),
    suggestedStage: "APPROACH_DISCUSSION",
    source: "fallback",
  };
}

function inferStage(reply: string) {
  const text = reply.toLowerCase();
  if (text.includes("complexity")) return "COMPLEXITY_DISCUSSION";
  if (text.includes("edge case") || text.includes("correct")) return "CORRECTNESS_DISCUSSION";
  if (text.includes("hint") || text.includes("data structure")) return "HINTING";
  return "APPROACH_DISCUSSION";
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
}

function finalizeReply(reply: string) {
  const normalized = reply.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return normalized;
  }

  if (/[.!?]["']?$/.test(normalized)) {
    return normalized;
  }

  const lastSentenceEnd = Math.max(
    normalized.lastIndexOf("."),
    normalized.lastIndexOf("?"),
    normalized.lastIndexOf("!"),
  );

  if (lastSentenceEnd >= normalized.length * 0.45) {
    return normalized.slice(0, lastSentenceEnd + 1).trim();
  }

  const lastClauseBreak = Math.max(
    normalized.lastIndexOf(","),
    normalized.lastIndexOf(";"),
    normalized.lastIndexOf(":"),
  );

  if (lastClauseBreak >= normalized.length * 0.65) {
    return `${normalized.slice(0, lastClauseBreak).trim()}.`;
  }

  return `${normalized}.`;
}

function findLatestTurn(transcripts: TranscriptLike[], speaker: TranscriptLike["speaker"]) {
  return [...transcripts].reverse().find((item) => item.speaker === speaker)?.text ?? null;
}

function withVariation(primary: string, previousAiTurn?: string, alternate?: string) {
  if (!previousAiTurn) {
    return primary;
  }

  const normalizedPrevious = previousAiTurn.trim().toLowerCase();
  if (normalizedPrevious === primary.trim().toLowerCase() && alternate) {
    return alternate;
  }

  return primary;
}
