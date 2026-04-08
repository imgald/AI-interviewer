import type { CandidateSignalSnapshot } from "@/lib/assistant/signal_extractor";
import type { MemoryLedger } from "@/lib/assistant/memory_ledger";
import type { CodingInterviewStage } from "@/lib/assistant/stages";

type ExecutionRunLike = {
  status: "PASSED" | "FAILED" | "ERROR" | "TIMEOUT";
  stdout?: string | null;
  stderr?: string | null;
};

export type InterviewerIntent =
  | "validate"
  | "probe"
  | "guide"
  | "pressure"
  | "unblock"
  | "advance"
  | "close";

export type IntentDecision = {
  intent: InterviewerIntent;
  targetSignal?: string;
  reason: string;
  expectedOutcome:
    | "confirm_strength"
    | "expose_gap"
    | "collect_missing_evidence"
    | "unlock_progress"
    | "advance_stage"
    | "close_topic";
  canDefer: boolean;
  urgency: "low" | "medium" | "high";
  competingIntents?: Array<{
    intent: InterviewerIntent;
    reason: string;
    score: number;
  }>;
};

export function decideInterviewerIntent(input: {
  currentStage: CodingInterviewStage;
  signals: CandidateSignalSnapshot;
  memory: MemoryLedger;
  latestExecutionRun?: ExecutionRunLike | null;
}): IntentDecision {
  const { currentStage, signals, memory, latestExecutionRun } = input;

  const withCompeting = (
    decision: Omit<IntentDecision, "competingIntents">,
    competingIntents: IntentDecision["competingIntents"],
  ): IntentDecision => ({
    ...decision,
    competingIntents,
  });

  if (
    memory.topicSaturation.summary >= 2 ||
    (currentStage === "WRAP_UP" && (signals.progress === "done" || memory.answeredTargets.includes("summary")))
  ) {
    return withCompeting({
      intent: "close",
      targetSignal: "summary",
      reason: "The active topic is already saturated, so the best move is to close the topic cleanly.",
      expectedOutcome: "close_topic",
      canDefer: false,
      urgency: "high",
    }, [
      { intent: "advance", reason: "The candidate may still be able to add one more summary sentence, but closure has more value now.", score: 0.42 },
      { intent: "validate", reason: "There is little remaining evidence gain from another validation pass once the topic is saturated.", score: 0.18 },
    ]);
  }

  if (latestExecutionRun && latestExecutionRun.status !== "PASSED") {
    return withCompeting({
      intent: memory.recentFailedRuns >= 2 ? "unblock" : "probe",
      targetSignal: "debugging",
      reason:
        memory.recentFailedRuns >= 2
          ? "Repeated failing runs mean the candidate needs help unlocking progress instead of another broad prompt."
          : "A failed run is the highest-signal path to expose and localize the current debugging gap.",
      expectedOutcome: memory.recentFailedRuns >= 2 ? "unlock_progress" : "expose_gap",
      canDefer: false,
      urgency: "high",
    }, [
      { intent: "guide", reason: "A lighter guide was possible, but the failing run gives stronger local debugging evidence.", score: 0.54 },
      { intent: "advance", reason: "Advancing is too risky while code execution is still failing.", score: 0.1 },
    ]);
  }

  if (
    (signals.readyToCode && signals.progress === "progressing") ||
    memory.missingEvidence.length === 0 ||
    (currentStage === "APPROACH_DISCUSSION" &&
      signals.understanding === "clear" &&
      (signals.algorithmChoice === "reasonable" || signals.algorithmChoice === "strong"))
  ) {
    return withCompeting({
      intent: "advance",
      targetSignal: currentStage === "APPROACH_DISCUSSION" ? "implementation" : "summary",
      reason: "The candidate has enough evidence at the current stage, so the interviewer should advance instead of front-loading more probing.",
      expectedOutcome: "advance_stage",
      canDefer: false,
      urgency: "high",
    }, [
      { intent: "validate", reason: "One more validation pass was available, but current evidence already clears the stage gate.", score: 0.46 },
      { intent: "pressure", reason: "Extra pressure would likely reduce flow more than it increases signal here.", score: 0.24 },
    ]);
  }

  if (signals.progress === "stuck") {
    return withCompeting({
      intent: "guide",
      targetSignal: "debugging",
      reason: "The candidate is losing momentum, so a guided move is more valuable than another evaluative probe.",
      expectedOutcome: "unlock_progress",
      canDefer: false,
      urgency: "medium",
    }, [
      { intent: "unblock", reason: "A stronger unblock was possible, but the candidate still looks recoverable with lighter guidance.", score: 0.58 },
      { intent: "probe", reason: "A probe might expose the gap, but would do less to restore momentum immediately.", score: 0.21 },
    ]);
  }

  if (signals.reasoningDepth === "thin" || signals.complexityRigor === "missing") {
    return withCompeting({
      intent: "validate",
      targetSignal: signals.reasoningDepth === "thin" ? "correctness" : "complexity",
      reason: "The candidate named the direction, but one core piece of reasoning still needs to be validated explicitly.",
      expectedOutcome: "confirm_strength",
      canDefer: true,
      urgency: "medium",
    }, [
      { intent: "probe", reason: "A harder probe could expose the gap more sharply, but validation is safer before escalating.", score: 0.49 },
      { intent: "advance", reason: "Advancing now would leave a core reasoning gap unresolved.", score: 0.17 },
    ]);
  }

  if (memory.unresolvedIssues.length > 0) {
    return withCompeting({
      intent: "probe",
      targetSignal: memory.unresolvedIssues[0]?.split(":")[0]?.trim().toLowerCase() || "correctness",
      reason: "The session still has a concrete unresolved issue, so a targeted probe can expose the remaining gap cleanly.",
      expectedOutcome: "expose_gap",
      canDefer: true,
      urgency: "medium",
    }, [
      { intent: "validate", reason: "Validation was possible, but the unresolved issue is concrete enough to justify a sharper probe.", score: 0.45 },
      { intent: "guide", reason: "Guidance would reduce pressure, but risks skipping a useful evaluative signal.", score: 0.22 },
    ]);
  }

  if (
    signals.communication === "clear" &&
    (signals.reasoningDepth === "moderate" || signals.reasoningDepth === "deep") &&
    currentStage !== "PROBLEM_UNDERSTANDING"
  ) {
    return withCompeting({
      intent: "pressure",
      targetSignal: "reasoning",
      reason: "The candidate sounds fluent enough that a slightly sharper follow-up can distinguish depth from fluency.",
      expectedOutcome: "confirm_strength",
      canDefer: true,
      urgency: "low",
    }, [
      { intent: "validate", reason: "A softer validation move was available, but a modest pressure test can separate fluency from real depth.", score: 0.52 },
      { intent: "advance", reason: "Advancing immediately would miss a chance to test depth under mild pressure.", score: 0.28 },
    ]);
  }

  return withCompeting({
    intent: "guide",
    targetSignal: "approach",
    reason: "The candidate is moving, but the interviewer still wants to collect one more useful signal without disrupting flow too aggressively.",
    expectedOutcome: "collect_missing_evidence",
    canDefer: true,
    urgency: "low",
  }, [
    { intent: "validate", reason: "Validation was possible, but the current state still benefits more from a lighter nudge.", score: 0.38 },
    { intent: "advance", reason: "Advancing immediately would leave a little too much uncertainty on the table.", score: 0.29 },
  ]);
}
