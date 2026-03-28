export type VoiceAvailability = {
  speechRecognition: boolean;
  speechSynthesis: boolean;
};

export type VoiceTranscriptChunk = {
  text: string;
  isFinal: boolean;
};

export type VoiceAdapterEventHandlers = {
  onTranscript?: (chunk: VoiceTranscriptChunk) => void;
  onStateChange?: (state: BrowserVoiceState) => void;
  onError?: (message: string) => void;
  onSpeechStart?: () => void;
};

export type BrowserVoiceState =
  | "idle"
  | "starting"
  | "listening"
  | "processing"
  | "speaking"
  | "error";

export interface InterviewVoiceAdapter {
  getAvailability(): VoiceAvailability;
  startListening(options?: { continuousMode?: boolean }): Promise<void>;
  stopListening(): void;
  speakText(text: string): Promise<void>;
  cancelSpeaking(): void;
  dispose(): void;
}
