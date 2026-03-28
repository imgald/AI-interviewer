import { prisma } from "@/lib/db";
import { getPersonaJobSnapshot, type PersonaJobSnapshot } from "@/lib/persona/queue";

export type OpsFeedScope = "all" | "persona" | "session";

export type AdminProfileListItem = {
  id: string;
  sourceUrl: string;
  sourceType: string;
  status: string;
  fetchStatus: string;
  personaSummary: string | null;
  currentRole: string | null;
  currentCompany: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UnifiedOpsEvent = {
  id: string;
  source: "persona" | "session";
  eventType: string;
  createdAt: string;
  title: string;
  description: string;
  payloadJson: unknown;
  sessionId?: string;
  interviewerProfileId?: string;
};

export type AdminProfileDetail = {
  profile: AdminProfileListItem;
  job: PersonaJobSnapshot | null;
  personaEvents: UnifiedOpsEvent[];
  sessionEvents: UnifiedOpsEvent[];
};

export async function listAdminProfiles(limit = 20): Promise<AdminProfileListItem[]> {
  const profiles = await prisma.interviewerProfile.findMany({
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  return profiles.map((profile) => ({
    id: profile.id,
    sourceUrl: profile.sourceUrl,
    sourceType: profile.sourceType,
    status: profile.status,
    fetchStatus: profile.fetchStatus,
    personaSummary: profile.personaSummary,
    currentRole: profile.currentRole,
    currentCompany: profile.currentCompany,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  }));
}

export async function getAdminProfileDetail(profileId: string): Promise<AdminProfileDetail | null> {
  const profile = await prisma.interviewerProfile.findUnique({
    where: { id: profileId },
    include: {
      jobEvents: {
        orderBy: { createdAt: "desc" },
        take: 30,
      },
      sessions: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          events: {
            orderBy: { eventTime: "desc" },
            take: 20,
          },
        },
      },
    },
  });

  if (!profile) {
    return null;
  }

  const job = await getPersonaJobSnapshot(profile.id);

  const personaEvents: UnifiedOpsEvent[] = profile.jobEvents.map((event) => ({
    id: event.id,
    source: "persona",
    eventType: event.eventType,
    createdAt: event.createdAt.toISOString(),
    title: prettifyEventType(event.eventType),
    description: buildPersonaEventDescription(event.eventType, event.payloadJson),
    payloadJson: event.payloadJson,
    interviewerProfileId: profile.id,
  }));

  const sessionEvents: UnifiedOpsEvent[] = profile.sessions.flatMap((session) =>
    session.events.map((event) => ({
      id: event.id,
      source: "session",
      eventType: event.eventType,
      createdAt: event.eventTime.toISOString(),
      title: prettifyEventType(event.eventType),
      description: buildSessionEventDescription(event.eventType, event.payloadJson),
      payloadJson: event.payloadJson,
      sessionId: session.id,
      interviewerProfileId: profile.id,
    })),
  );

  return {
    profile: {
      id: profile.id,
      sourceUrl: profile.sourceUrl,
      sourceType: profile.sourceType,
      status: profile.status,
      fetchStatus: profile.fetchStatus,
      personaSummary: profile.personaSummary,
      currentRole: profile.currentRole,
      currentCompany: profile.currentCompany,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    },
    job,
    personaEvents,
    sessionEvents,
  };
}

export function buildUnifiedOpsFeed(
  detail: AdminProfileDetail | null,
  scope: OpsFeedScope,
): UnifiedOpsEvent[] {
  if (!detail) {
    return [];
  }

  const combined =
    scope === "persona"
      ? detail.personaEvents
      : scope === "session"
        ? detail.sessionEvents
        : [...detail.personaEvents, ...detail.sessionEvents];

  return combined.sort((left, right) => {
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });
}

function prettifyEventType(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildPersonaEventDescription(eventType: string, payloadJson: unknown) {
  const payload = asRecord(payloadJson);

  if (eventType === "JOB_ENQUEUED") {
    return `Queued persona ingestion with job ${stringOrFallback(payload.jobId, "unknown")}.`;
  }

  if (eventType === "JOB_RETRY_SCHEDULED") {
    return `Retry scheduled after failure: ${stringOrFallback(payload.failedReason, "unknown reason")}`;
  }

  if (eventType === "JOB_FAILED") {
    return `Final persona ingestion failure: ${stringOrFallback(payload.failedReason, "unknown reason")}`;
  }

  if (eventType === "JOB_COMPLETED") {
    return `Persona preparation completed after ${stringOrFallback(payload.attemptsMade, "0")} attempt(s).`;
  }

  if (eventType === "JOB_PROCESSING_STARTED") {
    return `Worker started processing the public profile.`;
  }

  return "Persona pipeline event recorded.";
}

function buildSessionEventDescription(eventType: string, payloadJson: unknown) {
  const payload = asRecord(payloadJson);

  if (eventType === "SESSION_CREATED") {
    return `Session created for ${stringOrFallback(payload.mode, "unknown mode")} interview.`;
  }

  return "Session lifecycle event recorded.";
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function stringOrFallback(value: unknown, fallback: string) {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return fallback;
}
