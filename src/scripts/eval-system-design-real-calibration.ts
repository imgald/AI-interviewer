import { writeFile } from "node:fs/promises";
import path from "node:path";
import {
  evaluateRealCalibrationLabels,
  loadRealCalibrationLabelsFromJsonl,
} from "@/lib/evaluation/system-design-real-calibration";

function parseArgs(argv: string[]) {
  const inputIndex = argv.findIndex((item) => item === "--in");
  const outputIndex = argv.findIndex((item) => item === "--out");
  const inPath =
    inputIndex >= 0 && inputIndex + 1 < argv.length
      ? argv[inputIndex + 1]
      : path.join("data", "system-design-calibration", "real-transcripts.jsonl");
  const outPath = outputIndex >= 0 && outputIndex + 1 < argv.length ? argv[outputIndex + 1] : null;
  return { inPath, outPath };
}

async function main() {
  const { inPath, outPath } = parseArgs(process.argv.slice(2));
  const labels = await loadRealCalibrationLabelsFromJsonl(inPath);
  const evaluated = evaluateRealCalibrationLabels(labels);
  const payload = {
    generatedAt: new Date().toISOString(),
    inputPath: path.resolve(inPath),
    ...evaluated,
  };

  const json = JSON.stringify(payload, null, 2);
  if (outPath) {
    await writeFile(outPath, json, "utf8");
    console.log(`wrote real calibration evaluation to ${outPath}`);
    return;
  }
  console.log(json);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

