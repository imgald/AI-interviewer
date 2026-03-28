import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export async function logPersonaJobEvent(
  interviewerProfileId: string,
  eventType: string,
  payloadJson?: Prisma.InputJsonObject,
) {
  await prisma.personaJobEvent.create({
    data: {
      interviewerProfileId,
      eventType,
      payloadJson,
    },
  });
}
