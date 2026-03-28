import { fail, ok } from "@/lib/http";
import { getPersonaJobSnapshot } from "@/lib/persona/queue";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, { params }: RouteContext) {
  const { id } = await params;
  const job = await getPersonaJobSnapshot(id);

  if (!job) {
    return fail("Persona job not found", 404);
  }

  return ok(job);
}
