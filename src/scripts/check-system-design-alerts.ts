import { readSystemDesignMonitoringSnapshot } from "@/lib/operations/system-design-monitoring";

async function main() {
  const snapshot = await readSystemDesignMonitoringSnapshot();
  if (!snapshot) {
    console.error("cannot read weekly monitoring snapshot");
    process.exitCode = 1;
    return;
  }
  console.log(JSON.stringify(snapshot, null, 2));
  if (snapshot.criticalCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
