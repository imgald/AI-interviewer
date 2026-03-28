import type { BrowserVoiceState } from "@/lib/voice/types";

export function describeVoiceState(state: BrowserVoiceState) {
  switch (state) {
    case "idle":
      return "Mic idle";
    case "starting":
      return "Starting microphone";
    case "listening":
      return "Listening";
    case "processing":
      return "Processing speech";
    case "speaking":
      return "AI speaking";
    case "error":
      return "Voice error";
    default:
      return "Unknown";
  }
}
