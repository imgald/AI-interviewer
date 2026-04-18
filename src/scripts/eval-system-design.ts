import { writeFile } from "node:fs/promises";
import { access } from "node:fs/promises";
import path from "node:path";
import {
  evaluateSystemDesignRegressionHealth,
  evaluateSystemDesignRegressionStability,
  runSystemDesignRegressionLab,
} from "@/lib/assistant/policy-regression";
import {
  evaluateSystemDesignCalibrationPack,
  summarizeSystemDesignCalibrationPack,
} from "@/lib/evaluation/system-design-calibration";
import {
  evaluateRealCalibrationLabels,
  loadRealCalibrationLabelsFromJsonl,
  type RealCalibrationEvaluation,
} from "@/lib/evaluation/system-design-real-calibration";

type EvalPayload = {
  generatedAt: string;
  calibration: ReturnType<typeof evaluateSystemDesignCalibrationPack>;
  calibrationCoverage: ReturnType<typeof summarizeSystemDesignCalibrationPack>;
  realCalibration: {
    hasDataset: boolean;
    datasetPath: string;
    summary: RealCalibrationEvaluation | null;
  };
  regression: {
    reports: ReturnType<typeof runSystemDesignRegressionLab>;
    health: ReturnType<typeof evaluateSystemDesignRegressionHealth>;
    stability: ReturnType<typeof evaluateSystemDesignRegressionStability>;
  };
};

function parseArgs(argv: string[]) {
  const outIndex = argv.findIndex((item) => item === "--out");
  const outPath =
    outIndex >= 0 && outIndex + 1 < argv.length ? argv[outIndex + 1] : null;
  return { outPath };
}

async function main() {
  const { outPath } = parseArgs(process.argv.slice(2));
  const calibration = evaluateSystemDesignCalibrationPack();
  const calibrationCoverage = summarizeSystemDesignCalibrationPack();
  const realDatasetPath = path.join(process.cwd(), "data", "system-design-calibration", "real-transcripts.jsonl");
  const hasRealDataset = await hasFile(realDatasetPath);
  const realCalibration = hasRealDataset
    ? evaluateRealCalibrationLabels(await loadRealCalibrationLabelsFromJsonl(realDatasetPath))
    : null;
  const reports = runSystemDesignRegressionLab();
  const health = evaluateSystemDesignRegressionHealth(reports);
  const stability = evaluateSystemDesignRegressionStability();

  const payload: EvalPayload = {
    generatedAt: new Date().toISOString(),
    calibration,
    calibrationCoverage,
    realCalibration: {
      hasDataset: hasRealDataset,
      datasetPath: realDatasetPath,
      summary: realCalibration,
    },
    regression: {
      reports,
      health,
      stability,
    },
  };

  const json = JSON.stringify(payload, null, 2);
  if (outPath) {
    await writeFile(outPath, json, "utf8");
    console.log(`wrote system-design evaluation to ${outPath}`);
    return;
  }
  console.log(json);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function hasFile(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}
