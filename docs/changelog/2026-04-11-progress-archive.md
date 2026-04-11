# Progress Archive (April 11, 2026)

This file archives detailed implementation notes that were previously in `README.md`.
The README now keeps a concise, execution-focused view.

## Archived: Recent Progress

- Closed `Phase 5: Policy Optimization Lab`:
  - policy regression now runs deterministic multi-turn micro-simulations with decision/reward timelines
  - scenario-level comparison includes both score spread and reward spread
  - added golden scenarios for `overconfident_wrong_answer` and `perfect_flow`
  - `/admin` policy lab now shows reward gaps plus reward-driven tuning suggestions
- Added stronger coding interview policy orchestration:
  - current stage is derived from transcripts, session events, and the latest code run
  - assistant turns receive explicit stage context plus policy context
  - each stage has an explicit exit checklist
  - hints now escalate by recent hint count, stage stall, and repeated failed runs
  - prompt strategy can shift from `OPEN_ENDED` to `GUIDED` to `CONSTRAINED`
  - `STAGE_ADVANCED` is only recorded when the stage actually changes
- Improved the interview room so it feels more like a real conversation:
  - streaming AI replies over `SSE`
  - continuous listening mode
  - candidate speech interrupts AI playback and generation
  - adaptive silence thresholds for auto-submit
  - short interruption phrases like `wait` and `hold on` are ignored instead of being treated as full candidate turns
  - spoken candidate turns can be refined through a dedicated STT provider before being sent to the interviewer
  - when a dedicated STT provider is configured, the room can prefer provider-led speech handling over browser transcript timing
  - provider preview drafts can appear during speech, with final provider transcription used for the committed candidate turn
- Added session-level cost controls and observability:
  - `low-cost mode` can be enabled from setup
  - LLM context is trimmed more aggressively in low-cost mode
  - provider preview and STT calls are throttled more aggressively in low-cost mode
  - per-session `LLM_USAGE_RECORDED` and `STT_USAGE_RECORDED` events now produce rough cost estimates
  - interview room surfaces current LLM/STT call counts and estimated total cost
- Replaced the static code panel with a real Monaco editor.
- Added session code execution flow with persisted `CodeSnapshot` and `ExecutionRun`.
- Added multi-provider LLM support (`Gemini`, `OpenAI`, local fallback).
- Improved provider fallback visibility and resilience.
- Improved dedicated STT provider handling with failure classification and automatic browser fallback.
- Improved interviewer quality via shared interviewer skills.
- Improved `/admin` unified operations feed descriptions and readability.
- Expanded tests around route flow, stage inference, streaming routes, voice turn-taking, and admin feed descriptions.
- Added evaluation/report v0 with persisted report artifacts and standalone `/report/[id]`.

## Archived: Latest Interviewer Quality Upgrades

- Added `signal_extractor` as a perception layer with provider-backed structured observation and heuristic fallback.
- Added `decision_engine` as candidate-state-driven interviewer control.
- Provider replies are steered by decision engine + reply strategy and rewritten when too generic.
- Provider prompts now include structured issue groups and expected-answer contracts.
- Fallback order is explicit: preferred provider -> secondary provider -> local fallback.
- Added `reply_strategy.ts` mapping control actions to interviewer-style wording.
- Decision behavior now differentiates tradeoff probes, correctness probes, and hold/listen behavior.
- `/admin` and `/report` now expose state snapshots and decision replay.
- `memory_ledger` tracks answered targets and collected evidence.
- Added `critic.ts` and `pacing.ts` for turn quality/timing control.
- Decisions now carry `pressure` metadata.
- Critic verdicts include worth/timing signals and are persisted to events.
- Added low-cost rewrite pass before rule-based rewrite fallback.
- Streaming final transcript alignment improved to avoid post-hoc intent drift.
- Decision engine avoids repeated already-answered targets and closes topics when saturated.
- Added explicit closure actions (`move_to_wrap_up`, `close_topic`, `end_interview`).
- Added `interviewer_intent.ts` and `trajectory_estimator.ts` for intent/trajectory-aware control.
- Added pass-condition/topic gates for implementation, complexity, testing, and wrap-up.
- Intent and trajectory snapshots are persisted and visible in admin/report.
- Added `session_critic.ts` with session-level quality metrics.
- Candidate-state and decision snapshots now have dedicated persistence tables/read helpers.
- Added broad regression tests for signal extraction, decisions, reports, and provider fallback.
- Added finer correctness-risk pattern detection in signal extraction.
- Admin/report replay now surfaces unresolved issues, missing evidence, answered targets, and evidence focus.
- Admin/report expose pressure and critic worth signals as top-level cards.
- Stage replay in report is grouped by canonical snapshots and event evidence.
- Added `hinting_ledger.ts`; hint decisions now carry rescue/granularity/cost semantics.
- Report now aggregates hint efficiency and coachability signals.
- Added hard session budget guardrail and budget-closure behavior.
- Code execution supports stronger sandbox path (`CODE_SANDBOX_DRIVER=docker`) and timeout cleanup.
