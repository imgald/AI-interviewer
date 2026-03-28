import { fail, ok } from "@/lib/http";
import { getHealthSnapshot } from "@/lib/health";

export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await getHealthSnapshot();
  const db = snapshot.dependencies.db;

  if (db.status === "ok") {
    return ok({
      status: "ok",
      database: "postgres",
      latencyMs: db.latencyMs,
      timestamp: snapshot.timestamp,
    });
  }

  return fail("Database health check failed", 503, {
    status: "error",
    database: "postgres",
    latencyMs: db.latencyMs,
    timestamp: snapshot.timestamp,
    details: db.details,
  });
}
