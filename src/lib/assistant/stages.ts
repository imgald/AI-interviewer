type TranscriptLike = {
  speaker: "USER" | "AI" | "SYSTEM";
  text: string;
};

type SessionEventLike = {
  eventType: string;
  eventTime?: Date | string;
  payloadJson?: unknown;
};

type ExecutionRunLike = {
  status: "PASSED" | "FAILED" | "ERROR" | "TIMEOUT";
  stdout?: string | null;
  stderr?: string | null;
};

export const CODING_INTERVIEW_STAGES = [
  "PROBLEM_UNDERSTANDING",
  "APPROACH_DISCUSSION",
  "IMPLEMENTATION",
  "DEBUGGING",
  "TESTING_AND_COMPLEXITY",
  "WRAP_UP",
] as const;

export type CodingInterviewStage = (typeof CODING_INTERVIEW_STAGES)[number];
export const SYSTEM_DESIGN_STAGES = [
  "REQUIREMENTS",
  "API_CONTRACT_CHECK",
  "HIGH_LEVEL",
  "CAPACITY",
  "DEEP_DIVE",
  "REFINEMENT",
  "WRAP_UP",
] as const;
export type SystemDesignStage = (typeof SYSTEM_DESIGN_STAGES)[number];
export type InterviewStage = CodingInterviewStage | SystemDesignStage;

const STAGE_SET = new Set<string>(CODING_INTERVIEW_STAGES);
const SYSTEM_DESIGN_STAGE_SET = new Set<string>(SYSTEM_DESIGN_STAGES);

export function deriveCurrentCodingStage(input: {
  events?: SessionEventLike[];
  transcripts?: TranscriptLike[];
  latestExecutionRun?: ExecutionRunLike | null;
}): CodingInterviewStage {
  const latestStageEvent = [...(input.events ?? [])]
    .filter((event) => event.eventType === "STAGE_ADVANCED")
    .sort((left, right) => {
      const leftTime = new Date(left.eventTime ?? 0).getTime();
      const rightTime = new Date(right.eventTime ?? 0).getTime();
      return rightTime - leftTime;
    })
    .map((event) => asRecord(event.payloadJson).stage)
    .find(isCodingInterviewStage);

  if (latestStageEvent) {
    return latestStageEvent;
  }

  const latestRun = input.latestExecutionRun;
  if (latestRun?.status === "ERROR" || latestRun?.status === "FAILED" || latestRun?.status === "TIMEOUT") {
    return "DEBUGGING";
  }

  if (latestRun?.status === "PASSED") {
    return "TESTING_AND_COMPLEXITY";
  }

  const transcripts = input.transcripts ?? [];
  const latestUserTurn = [...transcripts].reverse().find((item) => item.speaker === "USER")?.text.toLowerCase() ?? "";
  const latestAiTurn = [...transcripts].reverse().find((item) => item.speaker === "AI")?.text.toLowerCase() ?? "";

  if (/\b(code|implement|write|function|loop)\b/.test(latestUserTurn)) {
    return "IMPLEMENTATION";
  }

  if (/\b(example|hash map|two pointers|sort|binary search|dfs|bfs|stack|queue)\b/.test(latestUserTurn)) {
    return "APPROACH_DISCUSSION";
  }

  if (latestAiTurn || latestUserTurn) {
    return "APPROACH_DISCUSSION";
  }

  return "PROBLEM_UNDERSTANDING";
}

export function describeCodingStage(stage: CodingInterviewStage) {
  switch (stage) {
    case "PROBLEM_UNDERSTANDING":
      return "Problem Understanding";
    case "APPROACH_DISCUSSION":
      return "Approach Discussion";
    case "IMPLEMENTATION":
      return "Implementation";
    case "DEBUGGING":
      return "Debugging";
    case "TESTING_AND_COMPLEXITY":
      return "Testing and Complexity";
    case "WRAP_UP":
      return "Wrap Up";
  }
}

export function describeSystemDesignStage(stage: SystemDesignStage) {
  switch (stage) {
    case "REQUIREMENTS":
      return "Requirements";
    case "API_CONTRACT_CHECK":
      return "API Contract Check";
    case "CAPACITY":
      return "Capacity";
    case "HIGH_LEVEL":
      return "High-Level Design";
    case "DEEP_DIVE":
      return "Deep Dive";
    case "REFINEMENT":
      return "Refinement";
    case "WRAP_UP":
      return "Wrap Up";
  }
}

export function describeInterviewStage(stage: string | null | undefined) {
  if (isCodingInterviewStage(stage)) {
    return describeCodingStage(stage);
  }
  if (isSystemDesignStage(stage)) {
    return describeSystemDesignStage(stage);
  }
  return null;
}

export function stageGuidance(stage: CodingInterviewStage) {
  switch (stage) {
    case "PROBLEM_UNDERSTANDING":
      return "Confirm the candidate understands the prompt, constraints, and success criteria before moving into solution design.";
    case "APPROACH_DISCUSSION":
      return "Stay on approach quality: examples, invariants, tradeoffs, and why this direction is appropriate.";
    case "IMPLEMENTATION":
      return "Push toward concrete implementation details and ask focused questions that help the candidate translate the idea into code.";
    case "DEBUGGING":
      return "Use the latest runtime signal to drive debugging. Ask the candidate to localize the issue before suggesting fixes.";
    case "TESTING_AND_COMPLEXITY":
      return "Focus on edge cases, correctness validation, and time/space complexity articulation.";
    case "WRAP_UP":
      return "Close the loop with a concise recap, final tradeoffs, and any last improvement the candidate would make.";
  }
}

export function inferSuggestedCodingStage(input: {
  currentStage?: string | null;
  latestExecutionRun?: ExecutionRunLike | null;
  latestUserTurn?: string | null;
  reply?: string | null;
}): CodingInterviewStage {
  const currentStage = isCodingInterviewStage(input.currentStage) ? input.currentStage : "PROBLEM_UNDERSTANDING";
  const latestRun = input.latestExecutionRun;

  if (latestRun?.status === "ERROR" || latestRun?.status === "FAILED" || latestRun?.status === "TIMEOUT") {
    return "DEBUGGING";
  }

  if (latestRun?.status === "PASSED") {
    const latestUserText = (input.latestUserTurn ?? "").toLowerCase();
    if (/\b(complexity|o\(|time|space|edge case|test)\b/.test(latestUserText)) {
      return "WRAP_UP";
    }
    return "TESTING_AND_COMPLEXITY";
  }

  const combined = `${input.reply ?? ""} ${input.latestUserTurn ?? ""}`.toLowerCase();

  if (/\b(restate|clarify|constraint|input|output)\b/.test(combined)) {
    if (currentStage === "IMPLEMENTATION" || currentStage === "TESTING_AND_COMPLEXITY" || currentStage === "WRAP_UP") {
      return currentStage;
    }
    return "PROBLEM_UNDERSTANDING";
  }

  if (/\b(debug|bug|error|failing|fix)\b/.test(combined)) {
    return "DEBUGGING";
  }

  if (/\b(edge case|test|complexity|time complexity|space complexity|correctness)\b/.test(combined)) {
    return currentStage === "WRAP_UP" ? "WRAP_UP" : "TESTING_AND_COMPLEXITY";
  }

  if (/\b(code|implement|write|function|loop|pointer|index)\b/.test(combined)) {
    return currentStage === "TESTING_AND_COMPLEXITY" || currentStage === "WRAP_UP" ? currentStage : "IMPLEMENTATION";
  }

  if (/\b(approach|example|walk me through|tradeoff|data structure|algorithm)\b/.test(combined)) {
    if (currentStage === "IMPLEMENTATION" || currentStage === "TESTING_AND_COMPLEXITY" || currentStage === "WRAP_UP") {
      return currentStage;
    }
    return "APPROACH_DISCUSSION";
  }

  return currentStage;
}

export function inferSystemDesignStage(input: {
  transcripts?: TranscriptLike[];
  events?: SessionEventLike[];
  latestUserTurn?: string | null;
  latestAiTurn?: string | null;
}): SystemDesignStage {
  return analyzeSystemDesignConversation(input).inferredStage;
}

export function analyzeSystemDesignConversation(input: {
  transcripts?: TranscriptLike[];
  events?: SessionEventLike[];
  latestUserTurn?: string | null;
  latestAiTurn?: string | null;
}) {
  const corpus = buildSystemDesignCorpus(input);

  const hasFunctionalBoundary = /\b(api|apis|endpoint|endpoints|feature|scope|assumption|requirement|functional|read path|write path)\b/.test(
    corpus,
  );
  const hasScaleSignal =
    /\b(scale|traffic|millions|global|high traffic|users|daily active|region|worldwide|qps|rps|tps|throughput)\b/.test(
      corpus,
    );
  const hasNonFunctional = /\b(latency|availability|durability|consistency|reliability|fault tolerance|p99|sla|slo)\b/.test(
    corpus,
  );
  const requirementsDone = hasFunctionalBoundary && hasScaleSignal && hasNonFunctional;

  const apiContractRequired =
    /\b(api|apis|endpoint|endpoints|rest|http|request|response|client|mobile|web|gateway)\b/.test(corpus);
  const apiContractDone =
    /\b(get|post|put|patch|delete)\b/.test(corpus) ||
    (/\b(endpoint|api|route)\b/.test(corpus) &&
      /\b(request|response|status code|idempot|pagination|cursor|version)\b/.test(corpus));

  const architectureDone =
    /\b(load balancer|api gateway|service|worker|queue|cache|database|replica|shard|partition|component)\b/.test(corpus) &&
    /\b(flow|architecture|high level|diagram|components?|data flow)\b/.test(corpus);

  const scalingActivated =
    /\b(scale|throughput|hotspot|bottleneck|replica|shard|partition|failover|multi region|multi-az|cost|capacity)\b/.test(
      corpus,
    );
  const capacityDone =
    /(\d+(\.\d+)?)\s*(qps|rps|tps|req\/s|requests? per second|mb|gb|tb|million|billion|k|m|b)/.test(
      corpus,
    ) &&
    /\b(given|therefore|so|which means|based on)\b/.test(corpus);

  const optimizationDiscussed = /\b(bottleneck|optimi[sz]e|tradeoff|spof|single point of failure|failover|hotspot)\b/.test(
    corpus,
  );
  const wrapUpLikely = /\b(summary|final design|wrap up|final recommendation|next steps)\b/.test(corpus);

  let inferredStage: SystemDesignStage = "REQUIREMENTS";
  if (!requirementsDone) {
    inferredStage = "REQUIREMENTS";
  } else if (apiContractRequired && !apiContractDone) {
    inferredStage = "API_CONTRACT_CHECK";
  } else if (!architectureDone) {
    inferredStage = "HIGH_LEVEL";
  } else if (scalingActivated && !capacityDone) {
    inferredStage = "CAPACITY";
  } else if (optimizationDiscussed) {
    inferredStage = wrapUpLikely ? "WRAP_UP" : "REFINEMENT";
  } else {
    inferredStage = "DEEP_DIVE";
  }

  return {
    requirementsDone,
    apiContractRequired,
    apiContractDone,
    architectureDone,
    scalingActivated,
    capacityDone,
    optimizationDiscussed,
    wrapUpLikely,
    inferredStage,
  };
}

export function deriveCurrentSystemDesignStage(input: {
  events?: SessionEventLike[];
  transcripts?: TranscriptLike[];
}): SystemDesignStage {
  const latestStageEvent = [...(input.events ?? [])]
    .filter((event) => event.eventType === "STAGE_ADVANCED")
    .sort((left, right) => {
      const leftTime = new Date(left.eventTime ?? 0).getTime();
      const rightTime = new Date(right.eventTime ?? 0).getTime();
      return rightTime - leftTime;
    })
    .map((event) => asRecord(event.payloadJson).stage)
    .find(isSystemDesignStage);

  if (latestStageEvent) {
    return latestStageEvent;
  }

  return inferSystemDesignStage({
    transcripts: input.transcripts,
    events: input.events,
  });
}

export function inferSuggestedSystemDesignStage(input: {
  currentStage?: string | null;
  latestUserTurn?: string | null;
  reply?: string | null;
  events?: SessionEventLike[];
}): SystemDesignStage {
  const currentStage = isSystemDesignStage(input.currentStage) ? input.currentStage : "REQUIREMENTS";
  const inferred = inferSystemDesignStage({
    latestUserTurn: input.latestUserTurn,
    latestAiTurn: input.reply,
    events: input.events,
  });

  if (compareSystemDesignStageOrder(inferred, currentStage) < 0) {
    return currentStage;
  }

  return inferred;
}

export function isCodingInterviewStage(value: unknown): value is CodingInterviewStage {
  return typeof value === "string" && STAGE_SET.has(value);
}

export function isSystemDesignStage(value: unknown): value is SystemDesignStage {
  return typeof value === "string" && SYSTEM_DESIGN_STAGE_SET.has(value);
}

export function compareSystemDesignStageOrder(left: SystemDesignStage, right: SystemDesignStage) {
  return SYSTEM_DESIGN_STAGES.indexOf(left) - SYSTEM_DESIGN_STAGES.indexOf(right);
}

function buildSystemDesignCorpus(input: {
  transcripts?: TranscriptLike[];
  events?: SessionEventLike[];
  latestUserTurn?: string | null;
  latestAiTurn?: string | null;
}) {
  const transcriptText = (input.transcripts ?? [])
    .filter((segment) => segment.speaker !== "SYSTEM")
    .map((segment) => segment.text)
    .join(" ");
  const eventStageText = (input.events ?? [])
    .filter((event) => event.eventType === "STAGE_ADVANCED")
    .map((event) => {
      const payload = asRecord(event.payloadJson);
      return `${String(payload.previousStage ?? "")} ${String(payload.stage ?? "")}`;
    })
    .join(" ");
  return `${transcriptText} ${input.latestUserTurn ?? ""} ${input.latestAiTurn ?? ""} ${eventStageText}`.toLowerCase();
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}
