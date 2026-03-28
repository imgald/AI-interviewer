import { fail, ok } from "@/lib/http";
import { listPersonaJobEvents } from "@/lib/persona/queue";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, { params }: RouteContext) {
  const { id } = await params;

  try {
    const events = await listPersonaJobEvents(id);
    return ok({ events });
  } catch (error) {
    return fail("Unable to load persona job events", 500, {
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
