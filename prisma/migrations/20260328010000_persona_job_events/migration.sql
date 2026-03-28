-- CreateTable
CREATE TABLE "PersonaJobEvent" (
    "id" TEXT NOT NULL,
    "interviewerProfileId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payloadJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonaJobEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PersonaJobEvent_interviewerProfileId_createdAt_idx" ON "PersonaJobEvent"("interviewerProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "PersonaJobEvent_eventType_createdAt_idx" ON "PersonaJobEvent"("eventType", "createdAt");

-- AddForeignKey
ALTER TABLE "PersonaJobEvent" ADD CONSTRAINT "PersonaJobEvent_interviewerProfileId_fkey" FOREIGN KEY ("interviewerProfileId") REFERENCES "InterviewerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
