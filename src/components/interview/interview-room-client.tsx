"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { getStarterCode, isRunnableLanguage, normalizeLanguage, toMonacoLanguage } from "@/lib/interview/editor";
import { SESSION_EVENT_TYPES } from "@/lib/session/event-types";
import { BrowserVoiceAdapter } from "@/lib/voice/browser-voice-adapter";
import type { BrowserVoiceState, InterviewVoiceAdapter, VoiceAvailability } from "@/lib/voice/types";
import { describeVoiceState } from "@/lib/voice/voice-status";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        minHeight: 360,
        borderRadius: 18,
        border: "1px solid var(--border)",
        background: "#1d2230",
      }}
    />
  ),
});

type TranscriptSegment = {
  id: string;
  speaker: "USER" | "AI" | "SYSTEM";
  segmentIndex: number;
  text: string;
  createdAt: string;
};

type SessionEvent = {
  id: string;
  eventType: string;
  eventTime: string;
  payloadJson: unknown;
};

type ExecutionRun = {
  id: string;
  status: "PASSED" | "FAILED" | "ERROR" | "TIMEOUT";
  stdout: string | null;
  stderr: string | null;
  runtimeMs: number | null;
  memoryKb: number | null;
  createdAt: string;
  codeSnapshot?: {
    id: string;
    language: string;
    snapshotIndex: number;
    source: string;
  } | null;
};

type InterviewRoomClientProps = {
  sessionId: string;
  questionTitle: string;
  questionPrompt: string;
  mode: string;
  selectedLanguage: string | null;
  targetLevel: string | null;
  personaEnabled: boolean;
  personaSummary: string | null;
  appliedPromptContext: string | null;
  initialTranscripts: TranscriptSegment[];
  initialEvents: SessionEvent[];
};

const cardStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-lg)",
  boxShadow: "var(--shadow)",
} as const;

const editorLanguageLabel = (language: string | null) => normalizeLanguage(language);

export function InterviewRoomClient(props: InterviewRoomClientProps) {
  const normalizedLanguage = normalizeLanguage(props.selectedLanguage);
  const monacoLanguage = toMonacoLanguage(props.selectedLanguage);
  const [transcripts, setTranscripts] = useState(props.initialTranscripts);
  const [events, setEvents] = useState(props.initialEvents);
  const [executionRuns, setExecutionRuns] = useState<ExecutionRun[]>([]);
  const [editorCode, setEditorCode] = useState(() => getStarterCode(props.selectedLanguage, props.questionTitle));
  const [isPending, startTransition] = useTransition();
  const [isRunningCode, setIsRunningCode] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [voiceState, setVoiceState] = useState<BrowserVoiceState>("idle");
  const [voiceAvailability, setVoiceAvailability] = useState<VoiceAvailability>({
    speechRecognition: false,
    speechSynthesis: false,
  });
  const [draftTranscript, setDraftTranscript] = useState("");
  const [lastVoiceError, setLastVoiceError] = useState<string | null>(null);
  const [editorStatus, setEditorStatus] = useState(
    isRunnableLanguage(props.selectedLanguage)
      ? "Code execution is ready for this language."
      : "Editing is enabled. Local execution currently supports Python and JavaScript.",
  );
  const [candidateMessage, setCandidateMessage] = useState("");
  const [isAssistantThinking, setIsAssistantThinking] = useState(false);
  const voiceAdapterRef = useRef<InterviewVoiceAdapter | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      const [transcriptResponse, eventsResponse, runsResponse] = await Promise.all([
        fetch(`/api/sessions/${props.sessionId}/transcripts`, { cache: "no-store" }),
        fetch(`/api/sessions/${props.sessionId}/events`, { cache: "no-store" }),
        fetch(`/api/sessions/${props.sessionId}/code-runs`, { cache: "no-store" }),
      ]);

      const [transcriptPayload, eventsPayload, runsPayload] = await Promise.all([
        transcriptResponse.json(),
        eventsResponse.json(),
        runsResponse.json(),
      ]);

      if (cancelled) {
        return;
      }

      if (transcriptPayload.ok) {
        setTranscripts(transcriptPayload.data.transcripts);
      }

      if (eventsPayload.ok) {
        setEvents(eventsPayload.data.events);
      }

      if (runsPayload.ok) {
        setExecutionRuns(runsPayload.data.executionRuns);
      }
    }

    void refresh();
    const interval = setInterval(() => void refresh(), 2500);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [props.sessionId]);

  useEffect(() => {
    void fetch(`/api/sessions/${props.sessionId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType: SESSION_EVENT_TYPES.INTERVIEW_ROOM_OPENED,
        payloadJson: {
          room: "coding-room",
        },
      }),
    });
  }, [props.sessionId]);

  useEffect(() => {
    const adapter = new BrowserVoiceAdapter({
      onTranscript: (chunk) => {
        setDraftTranscript(chunk.isFinal ? "" : chunk.text);
        setVoiceState(chunk.isFinal ? "processing" : "listening");

        if (chunk.isFinal) {
          void handleCandidateMessage(chunk.text);
        }
      },
      onStateChange: (state) => {
        setVoiceState(state);
      },
      onError: (message) => {
        setLastVoiceError(message);
      },
    });

    voiceAdapterRef.current = adapter;
    setVoiceAvailability(adapter.getAvailability());

    return () => {
      adapter.dispose();
      voiceAdapterRef.current = null;
    };
  }, [props.sessionId]);

  const timeline = useMemo(() => {
    return [...events].sort((left, right) => {
      return new Date(right.eventTime).getTime() - new Date(left.eventTime).getTime();
    });
  }, [events]);

  const latestRun = executionRuns[0] ?? null;

  function runAction(action: () => Promise<void>) {
    setActionError(null);
    startTransition(() => {
      void action().catch((error) => {
        setActionError(error instanceof Error ? error.message : "Unknown action failure");
      });
    });
  }

  async function postTranscript(speaker: "USER" | "AI", text: string) {
    const response = await fetch(`/api/sessions/${props.sessionId}/transcripts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        speaker,
        text,
        isFinal: true,
      }),
    });

    if (!response.ok) {
      throw new Error("Unable to persist transcript segment.");
    }

    const payload = await response.json();
    if (payload.ok) {
      setTranscripts((current) => [...current, payload.data.transcript]);
      setDraftTranscript("");
    }
  }

  async function requestAssistantTurn() {
    setIsAssistantThinking(true);

    try {
      const response = await fetch(`/api/sessions/${props.sessionId}/assistant-turn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.message ?? "Unable to generate assistant reply.");
      }

      if (payload.data.transcript) {
        setTranscripts((current) => [...current, payload.data.transcript]);
      }

      if (payload.data.events?.length) {
        setEvents((current) => [...payload.data.events, ...current]);
      }

      await voiceAdapterRef.current?.speakText(payload.data.transcript.text);
    } finally {
      setIsAssistantThinking(false);
    }
  }

  async function handleCandidateMessage(text: string) {
    await postTranscript("USER", text);
    await requestAssistantTurn();
  }

  async function postEvent(eventType: string, payloadJson?: Record<string, unknown>) {
    const response = await fetch(`/api/sessions/${props.sessionId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType,
        payloadJson,
      }),
    });

    if (!response.ok) {
      throw new Error("Unable to persist session event.");
    }

    const payload = await response.json();
    if (payload.ok) {
      setEvents((current) => [payload.data.event, ...current]);
    }
  }

  async function runCode() {
    setIsRunningCode(true);
    setActionError(null);
    setEditorStatus(`Running ${editorLanguageLabel(props.selectedLanguage)} in local sandbox...`);

    try {
      const response = await fetch(`/api/sessions/${props.sessionId}/code-runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: normalizedLanguage,
          code: editorCode,
          source: "RUN",
        }),
      });

      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.message ?? "Unable to execute code.");
      }

      setExecutionRuns((current) => [payload.data.executionRun, ...current].slice(0, 10));
      setEditorStatus(`Latest run: ${payload.data.executionRun.status}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to execute code.";
      setActionError(message);
      setEditorStatus(message);
    } finally {
      setIsRunningCode(false);
    }
  }

  async function startListening() {
    if (!voiceAdapterRef.current) {
      setLastVoiceError("Voice adapter is not ready.");
      return;
    }

    setLastVoiceError(null);
    await voiceAdapterRef.current.startListening();
  }

  function stopListening() {
    voiceAdapterRef.current?.stopListening();
  }

  async function speakAiPrompt(text: string) {
    await postTranscript("AI", text);
    await voiceAdapterRef.current?.speakText(text);
  }

  return (
    <main style={{ minHeight: "100vh", padding: 24 }}>
      <div style={{ width: "min(1280px, 100%)", margin: "0 auto", display: "grid", gap: 18 }}>
        <header
          style={{
            ...cardStyle,
            padding: 24,
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <p style={{ margin: 0, color: "var(--accent-strong)", fontWeight: 700 }}>INTERVIEW ROOM</p>
            <h1 style={{ margin: "6px 0 0" }}>{props.questionTitle}</h1>
          </div>
          <div style={{ color: "var(--muted)" }}>
            <div>Mode: {props.mode}</div>
            <div>Language: {editorLanguageLabel(props.selectedLanguage)}</div>
            <div>Level: {props.targetLevel ?? "Unspecified"}</div>
            <div>Persona: {props.personaEnabled ? "Enabled" : "Generic"}</div>
          </div>
        </header>

        <section style={{ display: "grid", gap: 18, gridTemplateColumns: "340px 1fr 360px" }}>
          <aside
            style={{
              ...cardStyle,
              padding: 20,
              display: "grid",
              gap: 18,
              alignContent: "start",
            }}
          >
            <div>
              <h2 style={{ marginTop: 0 }}>Prompt</h2>
              <p style={{ color: "var(--muted)", marginBottom: 0 }}>{props.questionPrompt}</p>
            </div>

            <div>
              <h2 style={{ marginTop: 0 }}>Interviewer Context</h2>
              <p style={{ color: "var(--muted)" }}>
                {props.personaSummary ?? "Generic interviewer persona for now."}
              </p>
              {props.appliedPromptContext ? (
                <p style={{ marginBottom: 0, fontSize: 14, color: "var(--muted)" }}>
                  Applied prompt context prepared and stored for orchestrator integration.
                </p>
              ) : null}
            </div>

            <div
              style={{
                padding: 16,
                borderRadius: 16,
                background: "var(--surface-alt)",
                border: "1px solid var(--border)",
                display: "grid",
                gap: 10,
              }}
            >
              <strong>Room Actions</strong>
              <div
                style={{
                  display: "grid",
                  gap: 8,
                  padding: 12,
                  borderRadius: 12,
                  background: "#fff",
                  border: "1px solid var(--border)",
                }}
              >
                <strong>Voice Controls</strong>
                <span style={{ color: "var(--muted)" }}>
                  {describeVoiceState(voiceState)}
                  {!voiceAvailability.speechRecognition ? " (speech recognition unavailable in this browser)" : ""}
                </span>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
                    style={actionButtonStyle}
                    disabled={!voiceAvailability.speechRecognition || isPending}
                    onClick={() => runAction(startListening)}
                  >
                    Start Mic
                  </button>
                  <button
                    style={actionButtonStyle}
                    disabled={!voiceAvailability.speechRecognition || isPending}
                    onClick={stopListening}
                    onMouseDown={() => {
                      void startListening();
                    }}
                    onMouseUp={stopListening}
                    onMouseLeave={stopListening}
                  >
                    Push to Talk
                  </button>
                  <button
                    style={actionButtonStyle}
                    disabled={!voiceAvailability.speechRecognition || isPending}
                    onClick={stopListening}
                  >
                    Stop Mic
                  </button>
                </div>
                {draftTranscript ? (
                  <div style={{ color: "var(--muted)", fontSize: 14 }}>
                    Draft transcript: {draftTranscript}
                  </div>
                ) : null}
                {lastVoiceError ? <span style={{ color: "var(--danger)" }}>{lastVoiceError}</span> : null}
              </div>
              <button
                style={actionButtonStyle}
                disabled={isPending}
                onClick={() =>
                  runAction(async () => {
                    await postEvent(SESSION_EVENT_TYPES.QUESTION_SHOWN, { surfacedInRoom: true });
                    await speakAiPrompt(`Let's begin. Walk me through your approach for ${props.questionTitle}.`);
                  })
                }
              >
                Simulate AI Intro
              </button>
              <button
                style={actionButtonStyle}
                disabled={isPending}
                onClick={() =>
                  runAction(async () => {
                    await handleCandidateMessage(
                      "I would start by clarifying constraints and then think through a hash map based approach.",
                    );
                  })
                }
              >
                Simulate Candidate Reply
              </button>
              <button
                style={actionButtonStyle}
                disabled={isPending || isAssistantThinking}
                onClick={() => runAction(async () => requestAssistantTurn())}
              >
                {isAssistantThinking ? "AI Thinking..." : "Ask AI Follow-up"}
              </button>
              <button
                style={actionButtonStyle}
                disabled={isPending}
                onClick={() => runAction(async () => postEvent(SESSION_EVENT_TYPES.HINT_REQUESTED, { source: "room-controls" }))}
              >
                Log Hint Request
              </button>
              <button
                style={actionButtonStyle}
                disabled={isPending}
                onClick={() => runAction(async () => postEvent(SESSION_EVENT_TYPES.STAGE_ADVANCED, { stage: "APPROACH_DISCUSSION" }))}
              >
                Advance Stage
              </button>
              {actionError ? <span style={{ color: "var(--danger)" }}>{actionError}</span> : null}
            </div>
          </aside>

          <section
            style={{
              ...cardStyle,
              padding: 20,
              display: "grid",
              gap: 18,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
              <div>
                <strong>Code Workspace</strong>
                <div style={{ color: "var(--muted)", fontSize: 14 }}>{editorStatus}</div>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button style={actionButtonStyle} disabled={isRunningCode} onClick={() => void runCode()}>
                  {isRunningCode ? "Running..." : "Run Code"}
                </button>
              </div>
            </div>

            <div
              style={{
                minHeight: 360,
                borderRadius: 18,
                border: "1px solid var(--border)",
                overflow: "hidden",
              }}
            >
              <MonacoEditor
                height="360px"
                language={monacoLanguage}
                theme="vs-dark"
                value={editorCode}
                onChange={(value) => setEditorCode(value ?? "")}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  scrollBeyondLastLine: false,
                  wordWrap: "on",
                }}
              />
            </div>

            <div
              style={{
                padding: 16,
                borderRadius: 16,
                background: "#fff",
                border: "1px solid var(--border)",
                display: "grid",
                gap: 10,
              }}
            >
              <strong>Candidate Message</strong>
              <textarea
                value={candidateMessage}
                onChange={(event) => setCandidateMessage(event.target.value)}
                placeholder="Type the candidate response here if you do not want to use the microphone."
                style={{
                  width: "100%",
                  minHeight: 92,
                  resize: "vertical",
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  padding: 12,
                  font: "inherit",
                }}
              />
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  style={actionButtonStyle}
                  disabled={!candidateMessage.trim() || isAssistantThinking}
                  onClick={() =>
                    runAction(async () => {
                      const message = candidateMessage.trim();
                      setCandidateMessage("");
                      await handleCandidateMessage(message);
                    })
                  }
                >
                  Send Candidate Reply
                </button>
                <button
                  style={actionButtonStyle}
                  disabled={isAssistantThinking}
                  onClick={() => runAction(async () => requestAssistantTurn())}
                >
                  {isAssistantThinking ? "AI Thinking..." : "Generate AI Reply"}
                </button>
              </div>
            </div>

            <div
              style={{
                padding: 16,
                borderRadius: 16,
                background: "var(--surface-alt)",
                border: "1px solid var(--border)",
                display: "grid",
                gap: 12,
              }}
            >
              <strong>Latest Run</strong>
              {latestRun ? (
                <>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", color: "var(--muted)", fontSize: 14 }}>
                    <span>Status: {latestRun.status}</span>
                    <span>Runtime: {latestRun.runtimeMs ?? 0}ms</span>
                    {latestRun.codeSnapshot ? (
                      <span>Snapshot #{latestRun.codeSnapshot.snapshotIndex}</span>
                    ) : null}
                  </div>
                  <OutputBlock title="stdout" value={latestRun.stdout} />
                  <OutputBlock title="stderr" value={latestRun.stderr} />
                </>
              ) : (
                <span style={{ color: "var(--muted)" }}>
                  No code runs yet. Execute the current editor contents to create a code snapshot and runtime record.
                </span>
              )}
            </div>
          </section>

          <aside
            style={{
              ...cardStyle,
              padding: 20,
              display: "grid",
              gap: 18,
              alignContent: "start",
            }}
          >
            <section style={{ display: "grid", gap: 10 }}>
              <h2 style={{ margin: 0 }}>Transcript</h2>
              <div style={{ display: "grid", gap: 10, maxHeight: 260, overflowY: "auto" }}>
                {transcripts.length === 0 ? (
                  <div style={emptyPanelStyle}>No transcript segments yet.</div>
                ) : (
                  transcripts.map((segment) => (
                    <div key={segment.id} style={transcriptBubble(segment.speaker)}>
                      <strong>{segment.speaker}</strong>
                      <span>{segment.text}</span>
                    </div>
                  ))
                )}
                {draftTranscript ? (
                  <div style={{ ...transcriptBubble("USER"), opacity: 0.7 }}>
                    <strong>USER (live)</strong>
                    <span>{draftTranscript}</span>
                  </div>
                ) : null}
              </div>
            </section>

            <section style={{ display: "grid", gap: 10 }}>
              <h2 style={{ margin: 0 }}>Session Timeline</h2>
              <div style={{ display: "grid", gap: 10, maxHeight: 220, overflowY: "auto" }}>
                {timeline.length === 0 ? (
                  <div style={emptyPanelStyle}>No session events yet.</div>
                ) : (
                  timeline.map((event) => (
                    <div key={event.id} style={timelineItemStyle}>
                      <strong>{event.eventType}</strong>
                      <span style={{ color: "var(--muted)", fontSize: 14 }}>
                        {new Date(event.eventTime).toLocaleTimeString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section style={{ display: "grid", gap: 10 }}>
              <h2 style={{ margin: 0 }}>Recent Runs</h2>
              <div style={{ display: "grid", gap: 10, maxHeight: 220, overflowY: "auto" }}>
                {executionRuns.length === 0 ? (
                  <div style={emptyPanelStyle}>No execution records yet.</div>
                ) : (
                  executionRuns.map((run) => (
                    <div key={run.id} style={timelineItemStyle}>
                      <strong>{run.status}</strong>
                      <span style={{ color: "var(--muted)", fontSize: 14 }}>
                        {new Date(run.createdAt).toLocaleTimeString()} · {run.runtimeMs ?? 0}ms
                      </span>
                    </div>
                  ))
                )}
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}

function OutputBlock({ title, value }: { title: string; value: string | null }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <span style={{ color: "var(--muted)", fontSize: 14 }}>{title}</span>
      <pre
        style={{
          margin: 0,
          padding: 12,
          borderRadius: 12,
          background: "#1d2230",
          color: "#ebf0ff",
          overflowX: "auto",
          minHeight: 48,
          whiteSpace: "pre-wrap",
        }}
      >
        {value?.trim() ? value : "(empty)"}
      </pre>
    </div>
  );
}

const actionButtonStyle = {
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: "10px 12px",
  background: "#fff",
  cursor: "pointer",
  textAlign: "left" as const,
} as const;

const emptyPanelStyle = {
  padding: 14,
  borderRadius: 14,
  border: "1px dashed var(--border)",
  color: "var(--muted)",
  background: "rgba(255,255,255,0.65)",
} as const;

const timelineItemStyle = {
  display: "grid",
  gap: 4,
  padding: 12,
  borderRadius: 12,
  background: "#fff",
  border: "1px solid var(--border)",
} as const;

function transcriptBubble(speaker: TranscriptSegment["speaker"]) {
  return {
    display: "grid",
    gap: 4,
    padding: 12,
    borderRadius: 14,
    border: "1px solid var(--border)",
    background:
      speaker === "AI"
        ? "rgba(24, 90, 219, 0.08)"
        : speaker === "USER"
          ? "#fff"
          : "rgba(0,0,0,0.04)",
  } as const;
}
