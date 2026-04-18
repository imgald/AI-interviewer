import { readFile } from "node:fs/promises";
import path from "node:path";

export type WeeklySnapshot = {
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

export type AlertThresholds = {
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

export type MonitoringAlert = {
  severity: "warning" | "critical";
  message: string;
};

export type MonitoringSnapshot = {
  generatedAt: string | null;
  source: {
    latestPath: string;
    datedPath: string | null;
  };
  metrics: {
    calibrationAccuracy: number;
    regressionPassRate: number;
    calibrationDelta: number;
    maxScoreVariance: number;
    maxRewardVariance: number;
    expectationFlips: number;
  };
  thresholds: AlertThresholds;
  warningCount: number;
  criticalCount: number;
  alerts: MonitoringAlert[];
  status: "ok" | "warning" | "critical";
};

export const DEFAULT_SYSTEM_DESIGN_ALERT_THRESHOLDS: AlertThresholds = {
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

export async function readSystemDesignMonitoringSnapshot(cwd = process.cwd()): Promise<MonitoringSnapshot | null> {
  const metricsDir = path.join(cwd, "docs", "metrics", "system-design-weekly");
  const latestPath = path.join(metricsDir, "latest.json");
  const latest = await readJsonFile<WeeklySnapshot>(latestPath);

  if (!latest) {
    return null;
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

  const alerts: MonitoringAlert[] = [];

  checkFloor({
    label: "calibration accuracy",
    value: calibrationAccuracy,
    warnFloor: DEFAULT_SYSTEM_DESIGN_ALERT_THRESHOLDS.calibrationWarnFloor,
    critFloor: DEFAULT_SYSTEM_DESIGN_ALERT_THRESHOLDS.calibrationCritFloor,
    alerts,
  });
  checkFloor({
    label: "regression pass rate",
    value: regressionPassRate,
    warnFloor: DEFAULT_SYSTEM_DESIGN_ALERT_THRESHOLDS.regressionPassRateWarnFloor,
    critFloor: DEFAULT_SYSTEM_DESIGN_ALERT_THRESHOLDS.regressionPassRateCritFloor,
    alerts,
  });
  checkCeiling({
    label: "max score variance",
    value: maxScoreVariance,
    warnCeiling: DEFAULT_SYSTEM_DESIGN_ALERT_THRESHOLDS.maxScoreVarianceWarn,
    critCeiling: DEFAULT_SYSTEM_DESIGN_ALERT_THRESHOLDS.maxScoreVarianceCrit,
    alerts,
  });
  checkCeiling({
    label: "max reward variance",
    value: maxRewardVariance,
    warnCeiling: DEFAULT_SYSTEM_DESIGN_ALERT_THRESHOLDS.maxRewardVarianceWarn,
    critCeiling: DEFAULT_SYSTEM_DESIGN_ALERT_THRESHOLDS.maxRewardVarianceCrit,
    alerts,
  });
  checkCeiling({
    label: "expectation flips",
    value: expectationFlips,
    warnCeiling: DEFAULT_SYSTEM_DESIGN_ALERT_THRESHOLDS.expectationFlipsWarn,
    critCeiling: DEFAULT_SYSTEM_DESIGN_ALERT_THRESHOLDS.expectationFlipsCrit,
    alerts,
  });
  checkFloor({
    label: "weekly calibration delta",
    value: calibrationDelta,
    warnFloor: DEFAULT_SYSTEM_DESIGN_ALERT_THRESHOLDS.driftWarnDelta,
    critFloor: DEFAULT_SYSTEM_DESIGN_ALERT_THRESHOLDS.driftCritDelta,
    alerts,
  });

  const criticalCount = alerts.filter((item) => item.severity === "critical").length;
  const warningCount = alerts.filter((item) => item.severity === "warning").length;

  return {
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
    thresholds: DEFAULT_SYSTEM_DESIGN_ALERT_THRESHOLDS,
    warningCount,
    criticalCount,
    alerts,
    status: criticalCount > 0 ? "critical" : warningCount > 0 ? "warning" : "ok",
  };
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function checkFloor(input: {
  label: string;
  value: number;
  warnFloor: number;
  critFloor: number;
  alerts: MonitoringAlert[];
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
  alerts: MonitoringAlert[];
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

