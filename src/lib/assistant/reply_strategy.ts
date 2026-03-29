import type { CandidateDecision } from "@/lib/assistant/decision_engine";
import type { CandidateSignalSnapshot } from "@/lib/assistant/signal_extractor";
import type { CodingInterviewStage } from "@/lib/assistant/stages";

export function describeReplyStrategy(
  decision: CandidateDecision,
  signals: CandidateSignalSnapshot,
) {
  const trend = signals.trendSummary ?? "No clear trend yet.";

  switch (decision.action) {
    case "hold_and_listen":
      return `Be brief and non-intrusive. Give the candidate room to continue, while lightly naming the one invariant, branch, or state update worth narrating. Trend context: ${trend}`;
    case "ask_for_reasoning":
      return `Probe the candidate's reasoning, not just the surface approach. Ask for one concrete example, invariant, or correctness argument. Trend context: ${trend}`;
    case "probe_tradeoff":
      return `Press on tradeoffs and algorithm choice. Compare the current approach against a stronger alternative and ask what efficiency or simplicity tradeoff the candidate is making. Trend context: ${trend}`;
    case "probe_correctness":
      return `Probe correctness tightly. Ask how the candidate knows the solution is correct on one example, branch, or invariant before moving on. Trend context: ${trend}`;
    case "ask_for_test_case":
      return `Ask explicitly for high-risk test cases or edge cases. Do not drift back into a broad approach discussion. Trend context: ${trend}`;
    case "ask_for_complexity":
      return `Ask explicitly for final time complexity, space complexity, and tradeoffs. Keep the follow-up precise and evaluative. Trend context: ${trend}`;
    case "ask_for_debug_plan":
      return `Localize the debugging discussion. Force the candidate to identify one failing input, one branch, or one state transition to inspect next. Trend context: ${trend}`;
    case "give_hint":
      return `Provide only the level of hint requested by the decision engine. Nudge the candidate without solving the problem outright. Trend context: ${trend}`;
    case "move_stage":
      return `Use a short transition to move the interview forward, then ask the required next question. Trend context: ${trend}`;
    case "encourage_and_continue":
      return `Acknowledge briefly and let the candidate keep momentum. Avoid over-talking; one concrete instruction is enough. Trend context: ${trend}`;
    case "ask_followup":
    default:
      return `Ask one focused follow-up that directly matches the decision target. Avoid generic praise or broad prompts. Trend context: ${trend}`;
  }
}

export function buildFallbackReplyFromDecision(input: {
  decision: CandidateDecision;
  signals: CandidateSignalSnapshot;
  currentStage: CodingInterviewStage;
  previousAiTurn?: string;
}) {
  const { decision, signals, currentStage, previousAiTurn } = input;
  const improving =
    signals.trendSummary &&
    /moved from (stuck|missing|partial) to (progressing|done|present|strong|moderate|deep)/i.test(
      signals.trendSummary,
    );

  switch (decision.action) {
    case "hold_and_listen":
      return chooseVariation(
        improving
          ? "This is getting sharper. Keep going, and just narrate the one invariant or branch you want me to track."
          : currentStage === "IMPLEMENTATION"
            ? "Keep coding. As you go, narrate the one branch or state update that is easiest to get wrong."
            : "Keep going. As you do, name the one invariant or state change that matters most.",
        previousAiTurn,
        "Continue from here, and keep me posted on the single state update or branch that matters most.",
      );
    case "ask_for_reasoning":
      return chooseVariation(
        improving
          ? `You are moving in a better direction now. ${decision.question}`
          : decision.question,
        previousAiTurn,
        "Slow down and make the reasoning explicit on one concrete example. Why should this logic stay correct?",
      );
    case "probe_tradeoff":
      return chooseVariation(
        decision.question,
        previousAiTurn,
        "Push on the tradeoff for me. What do you gain with this approach, and what stronger alternative are you giving up?",
      );
    case "probe_correctness":
      return chooseVariation(
        decision.question,
        previousAiTurn,
        "Before we move on, convince me the logic is correct on one concrete example or invariant.",
      );
    case "ask_for_test_case":
      return chooseVariation(
        decision.question,
        previousAiTurn,
        "Let's make validation explicit. Which edge cases would you test first, and what should happen on each one?",
      );
    case "ask_for_complexity":
      return chooseVariation(
        decision.question,
        previousAiTurn,
        "Now pin down the final time complexity, space complexity, and the main tradeoff behind this approach.",
      );
    case "ask_for_debug_plan":
      return chooseVariation(
        decision.question,
        previousAiTurn,
        "Localize the bug for me. Pick one failing input, then name the first branch or state transition you would inspect.",
      );
    case "encourage_and_continue":
      return chooseVariation(
        improving ? `You are heading in a better direction now. ${decision.question}` : decision.question,
        previousAiTurn,
        "That direction is workable. Keep moving, and call out the one invariant or branch that matters most.",
      );
    case "move_stage":
    case "ask_followup":
      return chooseVariation(decision.question, previousAiTurn, decision.question);
    default:
      return null;
  }
}

function chooseVariation(primary: string, previousAiTurn?: string, alternate?: string) {
  if (!previousAiTurn) {
    return primary;
  }

  const previous = previousAiTurn.trim().toLowerCase();
  if (previous === primary.trim().toLowerCase() && alternate) {
    return alternate;
  }

  return primary;
}
