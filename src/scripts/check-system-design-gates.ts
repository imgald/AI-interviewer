import {
  evaluateSystemDesignRegressionHealth,
  evaluateSystemDesignRegressionStability,
  runSystemDesignRegressionLab,
} from "@/lib/assistant/policy-regression";
import { evaluateSystemDesignCalibrationPack } from "@/lib/evaluation/system-design-calibration";

const THRESHOLDS = {
  calibrationAccuracyMin: 0.7,
  regressionPassRateMin: 1,
  maxScoreVariance: 0,
  maxRewardVariance: 0,
  maxExpectationFlips: 0,
} as const;

function main() {
  const calibration = evaluateSystemDesignCalibrationPack();
  const reports = runSystemDesignRegressionLab();
  const health = evaluateSystemDesignRegressionHealth(reports);
  const stability = evaluateSystemDesignRegressionStability();

  const failures: string[] = [];

  if (calibration.accuracy < THRESHOLDS.calibrationAccuracyMin) {
    failures.push(
      `calibration accuracy ${calibration.accuracy.toFixed(2)} below threshold ${THRESHOLDS.calibrationAccuracyMin.toFixed(2)}`,
    );
  }
  if (health.passRate < THRESHOLDS.regressionPassRateMin) {
    failures.push(
      `regression pass rate ${health.passRate.toFixed(2)} below threshold ${THRESHOLDS.regressionPassRateMin.toFixed(2)}`,
    );
  }
  if (stability.maxScoreVariance > THRESHOLDS.maxScoreVariance) {
    failures.push(
      `max score variance ${stability.maxScoreVariance.toFixed(4)} exceeds ${THRESHOLDS.maxScoreVariance.toFixed(4)}`,
    );
  }
  if (stability.maxRewardVariance > THRESHOLDS.maxRewardVariance) {
    failures.push(
      `max reward variance ${stability.maxRewardVariance.toFixed(4)} exceeds ${THRESHOLDS.maxRewardVariance.toFixed(4)}`,
    );
  }
  if (stability.expectationFlipCount > THRESHOLDS.maxExpectationFlips) {
    failures.push(
      `expectation flips ${stability.expectationFlipCount} exceeds ${THRESHOLDS.maxExpectationFlips}`,
    );
  }

  const summary = {
    calibrationAccuracy: calibration.accuracy,
    regressionPassRate: health.passRate,
    maxScoreVariance: stability.maxScoreVariance,
    maxRewardVariance: stability.maxRewardVariance,
    expectationFlipCount: stability.expectationFlipCount,
    thresholds: THRESHOLDS,
    passed: failures.length === 0,
  };

  console.log(JSON.stringify(summary, null, 2));

  if (failures.length > 0) {
    console.error("System-design quality gates failed:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exitCode = 1;
  }
}

main();

