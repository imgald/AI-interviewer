import { existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const mode = process.argv[2] ?? "run";
const extraArgs = process.argv.slice(3);
const isWindows = process.platform === "win32";

const vitestArgs = [mode, "--config", "vitest.config.mjs", ...extraArgs];

function runVitest() {
  const result = isWindows
    ? spawnSync("cmd.exe", ["/d", "/s", "/c", toWindowsCommand(["npx", "vitest", ...vitestArgs])], {
        stdio: "pipe",
        encoding: "utf8",
        shell: false,
        env: process.env,
      })
    : spawnSync("npx", ["vitest", ...vitestArgs], {
        stdio: "pipe",
        encoding: "utf8",
        shell: false,
        env: process.env,
      });
  if (result.error) {
    const message = String(result.error?.message ?? result.error);
    process.stderr.write(`${message}\n`);
  }
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
  return result;
}

function toWindowsCommand(parts) {
  return parts
    .map((part) => {
      if (!/[ \t"]/g.test(part)) {
        return part;
      }
      return `"${part.replace(/"/g, '\\"')}"`;
    })
    .join(" ");
}

function repairEsbuildWindows() {
  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, "node_modules", "esbuild", "esbuild.exe"),
    path.join(cwd, "node_modules", "esbuild", "bin", "esbuild"),
    path.join(cwd, "node_modules", "@esbuild", "win32-x64", "esbuild.exe"),
  ].filter((filePath) => existsSync(filePath));

  if (candidates.length === 0) {
    return;
  }

  const psScript = candidates
    .map((filePath) => {
      const escaped = filePath.replace(/'/g, "''");
      return [
        `if (Test-Path -LiteralPath '${escaped}') {`,
        `  Unblock-File -LiteralPath '${escaped}' -ErrorAction SilentlyContinue`,
        `  Remove-Item -LiteralPath '${escaped}:Zone.Identifier' -ErrorAction SilentlyContinue`,
        "}",
      ].join("\n");
    })
    .join("\n");

  spawnSync(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", psScript],
    { stdio: "ignore", shell: false },
  );
}

const first = runVitest();
if (first.status === 0) {
  process.exit(0);
}

const stderrText = String(first.stderr ?? "");
const stdoutText = String(first.stdout ?? "");
const errorText = String(first.error?.message ?? "");
const maybeEperm =
  /spawn EPERM/i.test(stderrText) || /spawn EPERM/i.test(stdoutText) || /spawn EPERM/i.test(errorText);

if (!maybeEperm || !isWindows) {
  process.exit(first.status ?? 1);
}

console.log("[test-safe] Detected spawn EPERM. Attempting Windows esbuild repair and retry...");
repairEsbuildWindows();

const second = runVitest();
if (second.status === 0) {
  process.exit(0);
}

console.error(
  "[test-safe] Retry still failed. Please run PowerShell as Administrator once, or whitelist esbuild.exe in endpoint protection.",
);
process.exit(second.status ?? 1);
