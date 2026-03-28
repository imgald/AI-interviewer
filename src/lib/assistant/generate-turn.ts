import { buildSkillsPrompt, DEFAULT_INTERVIEWER_SKILLS } from "@/lib/assistant/interviewer-skills";
import {
  describeCodingStage,
  inferSuggestedCodingStage,
  isCodingInterviewStage,
  stageGuidance,
  type CodingInterviewStage,
} from "@/lib/assistant/stages";

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
  currentStage?: string | null;
  recentTranscripts: TranscriptLike[];
  latestExecutionRun?: ExecutionRunLike | null;
};

type GenerateAssistantTurnResult = {
  reply: string;
  suggestedStage?: string;
  source: "fallback" | "openai" | "gemini";
};

export type StreamingAssistantTurnChunk = {
  textDelta?: string;
  final?: GenerateAssistantTurnResult;
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

export async function* streamAssistantTurn(
  input: GenerateAssistantTurnInput,
  options?: { signal?: AbortSignal },
): AsyncGenerator<StreamingAssistantTurnChunk> {
  const provider = resolveProvider();

  if (provider === "gemini" && process.env.GEMINI_API_KEY) {
    const stream = streamWithGemini(input, options);
    if (stream) {
      yield* stream;
      return;
    }
  }

  if ((provider === "openai" || process.env.OPENAI_API_KEY) && process.env.OPENAI_API_KEY) {
    const stream = streamWithOpenAI(input, options);
    if (stream) {
      yield* stream;
      return;
    }
  }

  const fallback = generateFallbackTurn(input);
  for (const chunk of chunkText(fallback.reply)) {
    if (options?.signal?.aborted) {
      return;
    }
    yield { textDelta: chunk };
  }
  yield { final: fallback };
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
    suggestedStage: inferStage(reply, input),
    source: "openai",
  };
}

async function* streamWithOpenAI(
  input: GenerateAssistantTurnInput,
  options?: { signal?: AbortSignal },
): AsyncGenerator<StreamingAssistantTurnChunk> {
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
      stream: true,
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
    signal: options?.signal,
  }).catch(() => null);

  if (!response?.ok || !response.body) {
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let accumulated = "";

  while (true) {
    if (options?.signal?.aborted) {
      return;
    }

    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const rawEvents = buffer.split("\n\n");
    buffer = rawEvents.pop() ?? "";

    for (const rawEvent of rawEvents) {
      const parsed = parseSseEvent(rawEvent);
      if (!parsed) {
        continue;
      }

      if (parsed.type === "response.output_text.delta" && typeof parsed.payload?.delta === "string") {
        accumulated += parsed.payload.delta;
        yield { textDelta: parsed.payload.delta };
      }
    }
  }

  if (!accumulated.trim()) {
    return;
  }

  const final = finalizeReply(accumulated);
  yield {
    final: {
      reply: final,
      suggestedStage: inferStage(final, input),
      source: "openai",
    },
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
    suggestedStage: inferStage(reply, input),
    source: "gemini",
  };
}

async function* streamWithGemini(
  input: GenerateAssistantTurnInput,
  options?: { signal?: AbortSignal },
): AsyncGenerator<StreamingAssistantTurnChunk> {
  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`,
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
      signal: options?.signal,
    },
  ).catch(() => null);

  if (!response?.ok || !response.body) {
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let accumulated = "";

  while (true) {
    if (options?.signal?.aborted) {
      return;
    }

    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const rawEvents = buffer.split("\n\n");
    buffer = rawEvents.pop() ?? "";

    for (const rawEvent of rawEvents) {
      const parsed = parseSseEvent(rawEvent);
      if (!parsed) {
        continue;
      }

      const textDelta = extractGeminiText(parsed.payload);
      if (!textDelta) {
        continue;
      }

      accumulated += textDelta;
      yield { textDelta };
    }
  }

  if (!accumulated.trim()) {
    return;
  }

  const final = finalizeReply(accumulated);
  yield {
    final: {
      reply: final,
      suggestedStage: inferStage(final, input),
      source: "gemini",
    },
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
  const stage = isCodingInterviewStage(input.currentStage) ? input.currentStage : "PROBLEM_UNDERSTANDING";
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
    `Current interview stage: ${describeCodingStage(stage)} (${stage})`,
    `Stage guidance: ${stageGuidance(stage)}`,
    `Persona summary: ${input.personaSummary ?? "generic interviewer"}`,
    `Applied prompt context: ${input.appliedPromptContext ?? "none"}`,
    input.latestExecutionRun
      ? `Latest code run: ${input.latestExecutionRun.status}. stdout=${truncate(input.latestExecutionRun.stdout ?? "", 180)} stderr=${truncate(input.latestExecutionRun.stderr ?? "", 180)}`
      : "Latest code run: none",
    `Latest AI turn: ${findLatestTurn(input.recentTranscripts, "AI") ?? "none"}`,
    `Latest user turn: ${findLatestTurn(input.recentTranscripts, "USER") ?? "none"}`,
    `Recent conversation:\n${recentTurns || "No turns yet."}`,
    "Write the interviewer's next single reply.",
    "Advance the interview deliberately. Stay in the current stage unless there is a clear reason to move forward.",
    "Do not repeat the previous AI sentence verbatim.",
  ].join("\n\n");
}

function generateFallbackTurn(input: GenerateAssistantTurnInput): GenerateAssistantTurnResult {
  const latestUserTurn = [...input.recentTranscripts].reverse().find((item) => item.speaker === "USER");
  const latestAiTurn = [...input.recentTranscripts].reverse().find((item) => item.speaker === "AI");
  const latestRun = input.latestExecutionRun;
  const currentStage: CodingInterviewStage = isCodingInterviewStage(input.currentStage)
    ? input.currentStage
    : "PROBLEM_UNDERSTANDING";

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

  if (currentStage === "PROBLEM_UNDERSTANDING") {
    if (/\b(hash map|two pointers|sort|stack|queue|binary search|dfs|bfs)\b/.test(latestUserText)) {
      return {
        reply: withVariation(
          "Good, that's a reasonable starting point. Walk me through one small example so I can see how that approach plays out step by step.",
          latestAiTurn?.text,
          "Okay, that sounds plausible. Use one concrete example and show me how your idea would evolve across the input.",
        ),
        suggestedStage: "APPROACH_DISCUSSION",
        source: "fallback",
      };
    }

    return {
      reply: withVariation(
        "Before we lock in an approach, what constraints or edge conditions matter most here, and how are you interpreting the expected output?",
        latestAiTurn?.text,
        "Let's stay on problem framing for a moment. What assumptions are you making about the input, and what would count as a correct output?",
      ),
      suggestedStage: "PROBLEM_UNDERSTANDING",
      source: "fallback",
    };
  }

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
        currentStage === "IMPLEMENTATION"
          ? "That approach sounds reasonable. As you code it, call out the core loop and any invariant that keeps the implementation correct."
          : "That sounds like a reasonable direction. Walk me through one concrete example and then tell me the expected time and space complexity.",
        latestAiTurn?.text,
        currentStage === "IMPLEMENTATION"
          ? "Okay, keep going at the implementation level. Which variables or pointers are carrying the key state, and how do they change over time?"
          : "Okay, that direction makes sense. Can you step through one example and explain why the data structure choice helps?",
      ),
      suggestedStage: currentStage === "IMPLEMENTATION" ? "IMPLEMENTATION" : "APPROACH_DISCUSSION",
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

  if (currentStage === "IMPLEMENTATION") {
    return {
      reply: withVariation(
        "Keep implementing, but narrate the key branches as you go. What is the trickiest line or condition in this solution?",
        latestAiTurn?.text,
        "As you write the code, focus on the part that's easiest to get wrong. Which branch or pointer update deserves the most care?",
      ),
      suggestedStage: "IMPLEMENTATION",
      source: "fallback",
    };
  }

  if (currentStage === "TESTING_AND_COMPLEXITY") {
    return {
      reply: withVariation(
        "Let's close the loop on validation. Which edge cases would you run, and what are the final time and space complexities?",
        latestAiTurn?.text,
        "Before we wrap, give me the edge cases you care about most and the final time and space complexity.",
      ),
      suggestedStage: "TESTING_AND_COMPLEXITY",
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
      currentStage === "WRAP_UP"
        ? "Wrap this up for me. What's the final approach, what are the tradeoffs, and what small improvement would you make with more time?"
        : "Keep going. Explain your approach step by step, and make sure you call out assumptions, edge cases, and the tradeoff behind your design choice.",
      latestAiTurn?.text,
      currentStage === "WRAP_UP"
        ? "Give me a concise final summary: core idea, complexity, and one follow-up improvement you would consider."
        : "You're heading in a reasonable direction. Keep walking me through it step by step, and be explicit about assumptions and tradeoffs.",
    ),
    suggestedStage: currentStage === "WRAP_UP" ? "WRAP_UP" : "APPROACH_DISCUSSION",
    source: "fallback",
  };
}

function inferStage(reply: string, input: GenerateAssistantTurnInput) {
  return inferSuggestedCodingStage({
    currentStage: input.currentStage,
    latestExecutionRun: input.latestExecutionRun,
    latestUserTurn: findLatestTurn(input.recentTranscripts, "USER"),
    reply,
  });
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

function* chunkText(text: string) {
  const parts = text.split(/(\s+)/).filter(Boolean);
  let buffer = "";

  for (const part of parts) {
    buffer += part;
    const wordCount = buffer.trim().split(/\s+/).filter(Boolean).length;
    if (/[.!?]["']?$/.test(part) || wordCount >= 5) {
      yield buffer;
      buffer = "";
    }
  }

  if (buffer.trim()) {
    yield buffer;
  }
}

function parseSseEvent(rawEvent: string) {
  const lines = rawEvent.split("\n");
  let payloadLine = "";

  for (const line of lines) {
    if (line.startsWith("data:")) {
      payloadLine += line.slice(5).trim();
    }
  }

  if (!payloadLine || payloadLine === "[DONE]") {
    return null;
  }

  try {
    const payload = JSON.parse(payloadLine) as Record<string, unknown>;
    return {
      type: typeof payload.type === "string" ? payload.type : "message",
      payload,
    };
  } catch {
    return null;
  }
}

function extractGeminiText(payload: Record<string, unknown>) {
  const candidates = payload.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return "";
  }

  const firstCandidate = candidates[0] as { content?: { parts?: Array<{ text?: string }> } };
  const parts = firstCandidate.content?.parts;
  if (!Array.isArray(parts) || parts.length === 0) {
    return "";
  }

  return parts.map((part) => part.text ?? "").join("");
}
