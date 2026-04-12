export type SystemDesignCalibrationLabel = {
  id: string;
  level: "Mid-level" | "Senior" | "Staff";
  hire: "NO_HIRE" | "BORDERLINE" | "HIRE" | "STRONG_HIRE";
  pivotMoments: number;
  dimensions: {
    requirement_clarity: number;
    capacity_instinct: number;
    tradeoff_depth: number;
    reliability_awareness: number;
    bottleneck_sensitivity: number;
  };
};

export const SYSTEM_DESIGN_CALIBRATION_PACK: SystemDesignCalibrationLabel[] = [
  {
    id: "sd-cal-001",
    level: "Mid-level",
    hire: "HIRE",
    pivotMoments: 1,
    dimensions: { requirement_clarity: 4.2, capacity_instinct: 3.1, tradeoff_depth: 3.3, reliability_awareness: 3.4, bottleneck_sensitivity: 3.2 },
  },
  {
    id: "sd-cal-002",
    level: "Mid-level",
    hire: "BORDERLINE",
    pivotMoments: 0,
    dimensions: { requirement_clarity: 3.6, capacity_instinct: 2.8, tradeoff_depth: 2.9, reliability_awareness: 3.0, bottleneck_sensitivity: 2.7 },
  },
  {
    id: "sd-cal-003",
    level: "Senior",
    hire: "HIRE",
    pivotMoments: 1,
    dimensions: { requirement_clarity: 4.5, capacity_instinct: 4.0, tradeoff_depth: 4.1, reliability_awareness: 4.0, bottleneck_sensitivity: 3.8 },
  },
  {
    id: "sd-cal-004",
    level: "Senior",
    hire: "STRONG_HIRE",
    pivotMoments: 2,
    dimensions: { requirement_clarity: 4.6, capacity_instinct: 4.3, tradeoff_depth: 4.4, reliability_awareness: 4.2, bottleneck_sensitivity: 4.1 },
  },
  {
    id: "sd-cal-005",
    level: "Staff",
    hire: "STRONG_HIRE",
    pivotMoments: 2,
    dimensions: { requirement_clarity: 4.7, capacity_instinct: 4.6, tradeoff_depth: 4.7, reliability_awareness: 4.6, bottleneck_sensitivity: 4.5 },
  },
  {
    id: "sd-cal-006",
    level: "Staff",
    hire: "HIRE",
    pivotMoments: 1,
    dimensions: { requirement_clarity: 4.5, capacity_instinct: 4.4, tradeoff_depth: 4.0, reliability_awareness: 4.4, bottleneck_sensitivity: 4.3 },
  },
  {
    id: "sd-cal-007",
    level: "Senior",
    hire: "HIRE",
    pivotMoments: 1,
    dimensions: { requirement_clarity: 4.3, capacity_instinct: 3.9, tradeoff_depth: 3.8, reliability_awareness: 3.9, bottleneck_sensitivity: 3.7 },
  },
  {
    id: "sd-cal-008",
    level: "Mid-level",
    hire: "NO_HIRE",
    pivotMoments: 0,
    dimensions: { requirement_clarity: 3.0, capacity_instinct: 2.3, tradeoff_depth: 2.1, reliability_awareness: 2.4, bottleneck_sensitivity: 2.2 },
  },
  {
    id: "sd-cal-009",
    level: "Senior",
    hire: "BORDERLINE",
    pivotMoments: 0,
    dimensions: { requirement_clarity: 4.0, capacity_instinct: 3.5, tradeoff_depth: 3.2, reliability_awareness: 3.6, bottleneck_sensitivity: 3.3 },
  },
  {
    id: "sd-cal-010",
    level: "Staff",
    hire: "HIRE",
    pivotMoments: 2,
    dimensions: { requirement_clarity: 4.6, capacity_instinct: 4.5, tradeoff_depth: 4.2, reliability_awareness: 4.5, bottleneck_sensitivity: 4.4 },
  },
];

export function evaluateSystemDesignCalibrationPack(
  labels: SystemDesignCalibrationLabel[] = SYSTEM_DESIGN_CALIBRATION_PACK,
) {
  const perSample = labels.map((label) => {
    const predicted = predictLevelFromDimensions(label.dimensions);
    return {
      id: label.id,
      expectedLevel: label.level,
      predictedLevel: predicted,
      match: predicted === label.level,
    };
  });

  const matches = perSample.filter((item) => item.match).length;
  const accuracy = labels.length > 0 ? Number((matches / labels.length).toFixed(2)) : 0;

  return {
    total: labels.length,
    matched: matches,
    accuracy,
    perSample,
  };
}

function predictLevelFromDimensions(dimensions: SystemDesignCalibrationLabel["dimensions"]) {
  const avg =
    (dimensions.requirement_clarity +
      dimensions.capacity_instinct +
      dimensions.tradeoff_depth +
      dimensions.reliability_awareness +
      dimensions.bottleneck_sensitivity) /
    5;

  let predicted: "Mid-level" | "Senior" | "Staff" = avg >= 4.2 ? "Staff" : avg >= 3.4 ? "Senior" : "Mid-level";
  if (predicted === "Staff" && dimensions.tradeoff_depth < 4) {
    predicted = "Senior";
  }
  if (predicted === "Staff" && dimensions.capacity_instinct < 4) {
    predicted = "Senior";
  }
  return predicted;
}

