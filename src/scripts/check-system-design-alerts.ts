import { readFile } from "node:fs/promises";
import path from "node:path";

type WeeklySnapshot = {
  generatedAt?: string;
  calibration?: {
    total?: number;
    matched?: number;
    accuracy?: number;
  };
  regression?: {
    health?: {
      passRate?: number;
    };
    stability?: {
      maxScoreVariance?: number;
      maxRewardVariance?: number;
      expectationFlipCount?: number;
    };
  };
};

type AlertThresholds = {
  calibrationWarnFloor: number;
  calibrationCritFloor: number;
  regressionPassRateWarnFloor: number;
  regressionPassRateCritFloor: number;
  driftWarnDelta: number;
  driftCritDelta: number;
  maxScoreVarianceWarn: number;
  maxScoreVarianceCrit: number;
  maxRewardVarianceWarn: number;
  maxRewardVarianceCrit: number;
  expectationFlipsWarn: number;
  expectationFlipsCrit: number;
};

const DEFAULT_THRESHOLDS: AlertThresholds = {
  calibrationWarnFloor: 0.72,
  calibrationCritFloor: 0.7,
  regressionPassRateWarnFloor: 1,
  regressionPassRateCritFloor: 0.98,
  driftWarnDelta: -0.03,
  driftCritDelta: -0.05,
  maxScoreVarianceWarn: 0,
  maxScoreVarianceCrit: 0.01,
  maxRewardVarianceWarn: 0,
  maxRewardVarianceCrit: 0.01,
  expectationFlipsWarn: 0,
  expectationFlipsCrit: 1,
};

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function main() {
  const metricsDir = path.join(process.cwd(), "docs", "metrics", "system-design-weekly");
  const latestPath = path.join(metricsDir, "latest.json");
  const latest = await readJsonFile<WeeklySnapshot>(latestPath);

  if (!latest) {
    console.error(`cannot read weekly snapshot: ${latestPath}`);
    process.exitCode = 1;
    return;
  }

  const dateKey = (latest.generatedAt ?? "").slice(0, 10);
  const datedPath = path.join(metricsDir, `snapshot-${dateKey}.json`);
  const datedSnapshot = await readJsonFile<{
    snapshot?: WeeklySnapshot;
    drift?: { calibrationAccuracyDelta?: number };
  }>(datedPath);

  const calibrationAccuracy = latest.calibration?.accuracy ?? 0;
  const regressionPassRate = latest.regression?.health?.passRate ?? 0;
  const maxScoreVariance = latest.regression?.stability?.maxScoreVariance ?? 0;
  const maxRewardVariance = latest.regression?.stability?.maxRewardVariance ?? 0;
  const expectationFlips = latest.regression?.stability?.expectationFlipCount ?? 0;
  const calibrationDelta = datedSnapshot?.drift?.calibrationAccuracyDelta ?? 0;

  const alerts: Array<{ severity: "warning" | "critical"; message: string }> = [];

  checkFloor({
    label: "calibration accuracy",
    value: calibrationAccuracy,
    warnFloor: DEFAULT_THRESHOLDS.calibrationWarnFloor,
    critFloor: DEFAULT_THRESHOLDS.calibrationCritFloor,
    alerts,
  });
  checkFloor({
    label: "regression pass rate",
    value: regressionPassRate,
    warnFloor: DEFAULT_THRESHOLDS.regressionPassRateWarnFloor,
    critFloor: DEFAULT_THRESHOLDS.regressionPassRateCritFloor,
    alerts,
  });
  checkCeiling({
    label: "max score variance",
    value: maxScoreVariance,
    warnCeiling: DEFAULT_THRESHOLDS.maxScoreVarianceWarn,
    critCeiling: DEFAULT_THRESHOLDS.maxScoreVarianceCrit,
    alerts,
  });
  checkCeiling({
    label: "max reward variance",
    value: maxRewardVariance,
    warnCeiling: DEFAULT_THRESHOLDS.maxRewardVarianceWarn,
    critCeiling: DEFAULT_THRESHOLDS.maxRewardVarianceCrit,
    alerts,
  });
  checkCeiling({
    label: "expectation flips",
    value: expectationFlips,
    warnCeiling: DEFAULT_THRESHOLDS.expectationFlipsWarn,
    critCeiling: DEFAULT_THRESHOLDS.expectationFlipsCrit,
    alerts,
  });
  checkFloor({
    label: "weekly calibration delta",
    value: calibrationDelta,
    warnFloor: DEFAULT_THRESHOLDS.driftWarnDelta,
    critFloor: DEFAULT_THRESHOLDS.driftCritDelta,
    alerts,
  });

  const criticalCount = alerts.filter((item) => item.severity === "critical").length;
  const warningCount = alerts.filter((item) => item.severity === "warning").length;

  const summary = {
    generatedAt: latest.generatedAt ?? null,
    source: {
      latestPath,
      datedPath: datedSnapshot ? datedPath : null,
    },
    metrics: {
      calibrationAccuracy,
      regressionPassRate,
      calibrationDelta,
      maxScoreVariance,
      maxRewardVariance,
      expectationFlips,
    },
    thresholds: DEFAULT_THRESHOLDS,
    warningCount,
    criticalCount,
    alerts,
    status: criticalCount > 0 ? "critical" : warningCount > 0 ? "warning" : "ok",
  };

  console.log(JSON.stringify(summary, null, 2));

  if (criticalCount > 0) {
    process.exitCode = 1;
  }
}

function checkFloor(input: {
  label: string;
  value: number;
  warnFloor: number;
  critFloor: number;
  alerts: Array<{ severity: "warning" | "critical"; message: string }>;
}) {
  if (input.value < input.critFloor) {
    input.alerts.push({
      severity: "critical",
      message: `${input.label}=${input.value.toFixed(4)} below critical floor ${input.critFloor.toFixed(4)}`,
    });
    return;
  }
  if (input.value < input.warnFloor) {
    input.alerts.push({
      severity: "warning",
      message: `${input.label}=${input.value.toFixed(4)} below warning floor ${input.warnFloor.toFixed(4)}`,
    });
  }
}

function checkCeiling(input: {
  label: string;
  value: number;
  warnCeiling: number;
  critCeiling: number;
  alerts: Array<{ severity: "warning" | "critical"; message: string }>;
}) {
  if (input.value > input.critCeiling) {
    input.alerts.push({
      severity: "critical",
      message: `${input.label}=${input.value.toFixed(4)} above critical ceiling ${input.critCeiling.toFixed(4)}`,
    });
    return;
  }
  if (input.value > input.warnCeiling) {
    input.alerts.push({
      severity: "warning",
      message: `${input.label}=${input.value.toFixed(4)} above warning ceiling ${input.warnCeiling.toFixed(4)}`,
    });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

