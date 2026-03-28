import { describe, expect, it } from "vitest";
import { describeVoiceState } from "@/lib/voice/voice-status";

describe("describeVoiceState", () => {
  it("describes listening state", () => {
    expect(describeVoiceState("listening")).toBe("Listening");
  });

  it("describes speaking state", () => {
    expect(describeVoiceState("speaking")).toBe("AI speaking");
  });
});
