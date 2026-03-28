import type {
  BrowserVoiceState,
  InterviewVoiceAdapter,
  VoiceAdapterEventHandlers,
  VoiceAvailability,
} from "@/lib/voice/types";

type BrowserSpeechRecognitionAlternative = {
  transcript?: string;
};

type BrowserSpeechRecognitionResult = {
  0?: BrowserSpeechRecognitionAlternative;
  isFinal: boolean;
};

type BrowserSpeechRecognitionResultList = ArrayLike<BrowserSpeechRecognitionResult>;

type BrowserSpeechRecognitionEvent = {
  resultIndex: number;
  results: BrowserSpeechRecognitionResultList;
};

type BrowserSpeechRecognitionErrorEvent = {
  error: string;
};

type BrowserSpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};

type BrowserSpeechRecognitionCtor = new () => BrowserSpeechRecognitionInstance;

declare global {
  interface Window {
    webkitSpeechRecognition?: BrowserSpeechRecognitionCtor;
    SpeechRecognition?: BrowserSpeechRecognitionCtor;
  }
}

function emitState(handlers: VoiceAdapterEventHandlers, state: BrowserVoiceState) {
  handlers.onStateChange?.(state);
}

export class BrowserVoiceAdapter implements InterviewVoiceAdapter {
  private recognition: BrowserSpeechRecognitionInstance | null = null;
  private handlers: VoiceAdapterEventHandlers;
  private state: BrowserVoiceState = "idle";
  private speechQueue: Promise<void> = Promise.resolve();
  private isDisposed = false;
  private shouldResumeListening = false;
  private utteranceSpeechDetected = false;
  private speechGeneration = 0;

  constructor(handlers: VoiceAdapterEventHandlers) {
    this.handlers = handlers;
    this.recognition = this.createRecognition();
  }

  getAvailability(): VoiceAvailability {
    if (typeof window === "undefined") {
      return {
        speechRecognition: false,
        speechSynthesis: false,
      };
    }

    return {
      speechRecognition: Boolean(window.SpeechRecognition || window.webkitSpeechRecognition),
      speechSynthesis: "speechSynthesis" in window,
    };
  }

  async startListening(options?: { continuousMode?: boolean }) {
    if (!this.recognition) {
      this.handlers.onError?.("Speech recognition is not available in this browser.");
      emitState(this.handlers, "error");
      return;
    }

    try {
      this.shouldResumeListening = options?.continuousMode ?? true;
      this.setState("starting");
      this.recognition.start();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to start speech recognition.";
      this.handlers.onError?.(message);
      this.setState("error");
    }
  }

  stopListening() {
    this.shouldResumeListening = false;
    this.recognition?.stop();
    if (this.state !== "speaking") {
      this.setState("idle");
    }
  }

  async speakText(text: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    const generation = ++this.speechGeneration;
    const speakTask = async () => {
      if (this.isDisposed || generation !== this.speechGeneration) {
        return;
      }

      this.setState("speaking");

      await new Promise<void>((resolve) => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.onend = () => {
          if (!this.isDisposed && generation === this.speechGeneration) {
            this.setState("idle");
          }
          resolve();
        };
        utterance.onerror = () => {
          this.handlers.onError?.("Speech synthesis failed.");
          if (!this.isDisposed && generation === this.speechGeneration) {
            this.setState("error");
          }
          resolve();
        };
        window.speechSynthesis.speak(utterance);
      });
    };

    this.speechQueue = this.speechQueue.then(speakTask, speakTask);
    await this.speechQueue;
  }

  cancelSpeaking() {
    this.speechGeneration += 1;
    this.speechQueue = Promise.resolve();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    this.setState("idle");
  }

  dispose() {
    this.isDisposed = true;
    this.stopListening();
    this.cancelSpeaking();
    this.recognition = null;
  }

  private setState(state: BrowserVoiceState) {
    this.state = state;
    emitState(this.handlers, state);
  }

  private createRecognition(): BrowserSpeechRecognitionInstance | null {
    if (typeof window === "undefined") {
      return null;
    }

    const RecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!RecognitionCtor) {
      return null;
    }

    const recognition = new RecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      this.utteranceSpeechDetected = false;
      this.setState("listening");
    };

    recognition.onresult = (event: BrowserSpeechRecognitionEvent) => {
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result[0]?.transcript?.trim();
        if (!transcript) {
          continue;
        }

        if (!this.utteranceSpeechDetected) {
          this.utteranceSpeechDetected = true;
          this.handlers.onSpeechStart?.();
        }

        this.handlers.onTranscript?.({
          text: transcript,
          isFinal: result.isFinal,
        });
      }
    };

    recognition.onerror = (event: BrowserSpeechRecognitionErrorEvent) => {
      this.handlers.onError?.(`Speech recognition error: ${event.error}`);
      this.setState("error");
    };

    recognition.onend = () => {
      this.utteranceSpeechDetected = false;
      if (this.state !== "speaking" && this.state !== "error") {
        this.setState("idle");
      }

      if (this.shouldResumeListening && !this.isDisposed) {
        queueMicrotask(() => {
          if (!this.shouldResumeListening || this.isDisposed || !this.recognition) {
            return;
          }

          try {
            this.setState("starting");
            this.recognition.start();
          } catch {
            // Browser recognition can throw if restarted too quickly; the next user action can recover.
          }
        });
      }
    };

    return recognition;
  }
}
