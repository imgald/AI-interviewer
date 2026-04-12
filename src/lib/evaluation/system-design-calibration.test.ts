import { describe, expect, it } from "vitest";
import {
  SYSTEM_DESIGN_CALIBRATION_PACK,
  evaluateSystemDesignCalibrationPack,
} from "@/lib/evaluation/system-design-calibration";

describe("system design calibration pack", () => {
  it("provides a usable baseline pack for calibration runs", () => {
    expect(SYSTEM_DESIGN_CALIBRATION_PACK.length).toBeGreaterThanOrEqual(10);
  });

  it("returns level agreement metrics with non-linear caps applied", () => {
    const result = evaluateSystemDesignCalibrationPack();
    expect(result.total).toBeGreaterThan(0);
    expect(result.accuracy).toBeGreaterThanOrEqual(0);
    expect(result.accuracy).toBeLessThanOrEqual(1);
    expect(result.perSample.length).toBe(result.total);
  });
});

