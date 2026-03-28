import { prisma } from "@/lib/db";
import { fail, ok } from "@/lib/http";
import { getPersonaJobSnapshot, listPersonaJobEvents } from "@/lib/persona/queue";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, { params }: RouteContext) {
  const { id } = await params;

  const profile = await prisma.interviewerProfile.findUnique({
    where: { id },
    include: { sources: true },
  });

  if (!profile) {
    return fail("Interviewer profile not found", 404);
  }

  const job = await getPersonaJobSnapshot(profile.id);
  const events = await listPersonaJobEvents(profile.id, 10);

  return ok({
    id: profile.id,
    status: profile.status,
    fetchStatus: profile.fetchStatus,
    fullName: profile.fullName,
    headline: profile.headline,
    currentRole: profile.currentRole,
    currentCompany: profile.currentCompany,
    personaSummary: profile.personaSummary,
    technicalFocus: profile.technicalFocus,
    likelyInterviewFocus: profile.likelyInterviewFocus,
    communicationStyleGuess: profile.communicationStyleGuess,
    confidence: profile.confidence,
    fetchedAt: profile.fetchedAt,
    job,
    events,
  });
}
