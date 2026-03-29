import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";

function escapeJson(value: unknown) {
  const json = JSON.stringify(value ?? null);
  return json.replace(/'/g, "''");
}

function escapeText(value: string | null | undefined) {
  if (!value) {
    return "NULL";
  }

  return `'${value.replace(/'/g, "''")}'`;
}

export async function persistSessionSnapshots(input: {
  sessionId: string;
  stage?: string | null;
  source?: string | null;
  signals?: unknown;
  decision?: unknown;
}) {
  const operations: Promise<unknown>[] = [];

  if (input.signals) {
    operations.push(
      prisma.$executeRawUnsafe(
        `INSERT INTO "CandidateStateSnapshot" ("id", "sessionId", "stage", "source", "snapshotJson", "createdAt") VALUES ('${randomUUID()}', '${input.sessionId}', ${escapeText(input.stage)}, ${escapeText(input.source)}, '${escapeJson(input.signals)}'::jsonb, NOW())`,
      ),
    );
  }

  if (input.decision) {
    operations.push(
      prisma.$executeRawUnsafe(
        `INSERT INTO "InterviewerDecisionSnapshot" ("id", "sessionId", "stage", "source", "decisionJson", "createdAt") VALUES ('${randomUUID()}', '${input.sessionId}', ${escapeText(input.stage)}, ${escapeText(input.source)}, '${escapeJson(input.decision)}'::jsonb, NOW())`,
      ),
    );
  }

  if (operations.length === 0) {
    return;
  }

  try {
    await Promise.all(operations);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[session-snapshots] snapshot persistence skipped", error);
    }
  }
}
