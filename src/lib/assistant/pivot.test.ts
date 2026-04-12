import { describe, expect, it } from "vitest";
import { detectPivotMoment } from "@/lib/assistant/pivot";

describe("detectPivotMoment", () => {
  it("detects pivot only when hint, new dimension, and signal improvement co-occur", () => {
    const pivot = detectPivotMoment({
      decision: {
        action: "probe_tradeoff",
        target: "tradeoff",
      },
      recentEvents: [
        { eventType: "HINT_SERVED", payloadJson: { hintLevel: "L1_AREA" } },
        { eventType: "DECISION_RECORDED", payloadJson: { decision: { target: "requirement" } } },
        {
          eventType: "SIGNAL_SNAPSHOT_RECORDED",
          payloadJson: {
            signals: {
              designSignals: {
                signals: {
                  requirement_missing: true,
                  capacity_missing: true,
                  tradeoff_missed: true,
                  spof_missed: true,
                  bottleneck_unexamined: true,
                },
              },
            },
          },
        },
        {
          eventType: "SIGNAL_SNAPSHOT_RECORDED",
          payloadJson: {
            signals: {
              designSignals: {
                signals: {
                  requirement_missing: false,
                  capacity_missing: true,
                  tradeoff_missed: true,
                  spof_missed: true,
                  bottleneck_unexamined: true,
                },
              },
            },
          },
        },
      ],
    });

    expect(pivot.detected).toBe(true);
    expect(pivot.impactScore).toBeGreaterThan(0);
  });

  it("does not trigger when no recent hint was served", () => {
    const pivot = detectPivotMoment({
      decision: {
        action: "probe_tradeoff",
        target: "tradeoff",
      },
      recentEvents: [
        { eventType: "DECISION_RECORDED", payloadJson: { decision: { target: "requirement" } } },
        {
          eventType: "SIGNAL_SNAPSHOT_RECORDED",
          payloadJson: {
            signals: {
              designSignals: {
                signals: {
                  requirement_missing: true,
                  capacity_missing: true,
                  tradeoff_missed: true,
                  spof_missed: true,
                  bottleneck_unexamined: true,
                },
              },
            },
          },
        },
        {
          eventType: "SIGNAL_SNAPSHOT_RECORDED",
          payloadJson: {
            signals: {
              designSignals: {
                signals: {
                  requirement_missing: false,
                  capacity_missing: true,
                  tradeoff_missed: true,
                  spof_missed: true,
                  bottleneck_unexamined: true,
                },
              },
            },
          },
        },
      ],
    });

    expect(pivot.detected).toBe(false);
    expect(pivot.impactScore).toBe(0);
  });
});

