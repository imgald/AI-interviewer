import { fail, ok } from "@/lib/http";
import { getHealthSnapshot } from "@/lib/health";

export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await getHealthSnapshot();

  if (snapshot.status === "ok") {
    return ok(snapshot);
  }

  return fail("One or more dependencies are unhealthy", 503, snapshot);
}
