-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "InterviewMode" AS ENUM ('CODING', 'SYSTEM_DESIGN');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('CREATED', 'PREPARING', 'READY', 'IN_PROGRESS', 'COMPLETED', 'ABANDONED', 'FAILED');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('CODING', 'SYSTEM_DESIGN');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "CompanyStyle" AS ENUM ('GENERIC', 'AMAZON', 'META', 'GOOGLE', 'STRIPE');

-- CreateEnum
CREATE TYPE "TargetLevel" AS ENUM ('NEW_GRAD', 'SDE1', 'SDE2', 'SENIOR', 'STAFF');

-- CreateEnum
CREATE TYPE "Speaker" AS ENUM ('USER', 'AI', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('PASSED', 'FAILED', 'ERROR', 'TIMEOUT');

-- CreateEnum
CREATE TYPE "Recommendation" AS ENUM ('STRONG_HIRE', 'HIRE', 'BORDERLINE', 'NO_HIRE');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('LINKEDIN', 'PERSONAL_SITE', 'GITHUB', 'SCHOLAR', 'COMPANY_BIO', 'BLOG', 'OTHER');

-- CreateEnum
CREATE TYPE "FetchStatus" AS ENUM ('PENDING', 'FETCHING', 'SUCCEEDED', 'FAILED', 'UNSUPPORTED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "PersonaStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED', 'PARTIAL');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetRole" TEXT,
    "targetLevel" "TargetLevel",
    "preferredLanguage" TEXT,
    "interviewFocus" TEXT,
    "targetCompanies" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "difficulty" "Difficulty" NOT NULL,
    "companyStyle" "CompanyStyle",
    "levelTarget" "TargetLevel",
    "topicTags" JSONB,
    "estimatedMinutes" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionHint" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "hintLevel" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionHint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionFollowup" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "triggerCondition" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionFollowup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionRubric" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "dimensionKey" TEXT NOT NULL,
    "dimensionLabel" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "maxScore" INTEGER NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionRubric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferenceSolution" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "language" TEXT,
    "content" TEXT NOT NULL,
    "solutionNotes" TEXT,
    "complexityTime" TEXT,
    "complexitySpace" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferenceSolution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewerProfile" (
    "id" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "sourceType" "SourceType" NOT NULL,
    "fullName" TEXT,
    "headline" TEXT,
    "currentCompany" TEXT,
    "currentRole" TEXT,
    "location" TEXT,
    "bioSummary" TEXT,
    "specialties" JSONB,
    "education" JSONB,
    "publications" JSONB,
    "signalsJson" JSONB,
    "personaSummary" TEXT,
    "seniorityEstimate" TEXT,
    "technicalFocus" JSONB,
    "likelyInterviewFocus" JSONB,
    "communicationStyleGuess" JSONB,
    "confidence" DOUBLE PRECISION,
    "status" "PersonaStatus" NOT NULL DEFAULT 'PENDING',
    "fetchStatus" "FetchStatus" NOT NULL DEFAULT 'PENDING',
    "fetchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewerProfileSource" (
    "id" TEXT NOT NULL,
    "interviewerProfileId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sourceType" "SourceType" NOT NULL,
    "rawTextExcerpt" TEXT,
    "normalizedContent" TEXT,
    "fetchStatus" "FetchStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "fetchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewerProfileSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT,
    "mode" "InterviewMode" NOT NULL,
    "status" "SessionStatus" NOT NULL,
    "selectedLanguage" TEXT,
    "companyStyle" "CompanyStyle",
    "targetLevel" "TargetLevel",
    "voiceEnabled" BOOLEAN NOT NULL DEFAULT true,
    "finalRecommendation" "Recommendation",
    "interviewerProfileUrl" TEXT,
    "interviewerProfileId" TEXT,
    "personaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "personaStatus" "PersonaStatus",
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "durationSeconds" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionInterviewerContext" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "interviewerProfileId" TEXT NOT NULL,
    "personaSnapshotJson" JSONB NOT NULL,
    "appliedPromptContext" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionInterviewerContext_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionEvent" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payloadJson" JSONB,

    CONSTRAINT "SessionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TranscriptSegment" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "speaker" "Speaker" NOT NULL,
    "segmentIndex" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "startedAtMs" INTEGER,
    "endedAtMs" INTEGER,
    "isFinal" BOOLEAN NOT NULL DEFAULT true,
    "audioUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TranscriptSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodeSnapshot" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "snapshotIndex" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CodeSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExecutionRun" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "codeSnapshotId" TEXT,
    "stdin" TEXT,
    "testCasesJson" JSONB,
    "stdout" TEXT,
    "stderr" TEXT,
    "status" "ExecutionStatus" NOT NULL,
    "runtimeMs" INTEGER,
    "memoryKb" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExecutionRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evaluation" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "overallScore" DOUBLE PRECISION,
    "overallSummary" TEXT,
    "strengths" JSONB,
    "weaknesses" JSONB,
    "missedSignals" JSONB,
    "improvementPlan" JSONB,
    "recommendation" "Recommendation",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Evaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationDimensionScore" (
    "id" TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "dimensionKey" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "maxScore" DOUBLE PRECISION NOT NULL,
    "evidence" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvaluationDimensionScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedbackReport" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "reportVersion" TEXT NOT NULL,
    "reportJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedbackReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Question_slug_key" ON "Question"("slug");

-- CreateIndex
CREATE INDEX "QuestionHint_questionId_hintLevel_idx" ON "QuestionHint"("questionId", "hintLevel");

-- CreateIndex
CREATE INDEX "QuestionFollowup_questionId_phase_idx" ON "QuestionFollowup"("questionId", "phase");

-- CreateIndex
CREATE INDEX "QuestionRubric_questionId_idx" ON "QuestionRubric"("questionId");

-- CreateIndex
CREATE INDEX "ReferenceSolution_questionId_idx" ON "ReferenceSolution"("questionId");

-- CreateIndex
CREATE INDEX "InterviewerProfile_status_idx" ON "InterviewerProfile"("status");

-- CreateIndex
CREATE INDEX "InterviewerProfile_sourceType_idx" ON "InterviewerProfile"("sourceType");

-- CreateIndex
CREATE INDEX "InterviewerProfile_sourceUrl_idx" ON "InterviewerProfile"("sourceUrl");

-- CreateIndex
CREATE INDEX "InterviewerProfileSource_interviewerProfileId_idx" ON "InterviewerProfileSource"("interviewerProfileId");

-- CreateIndex
CREATE INDEX "InterviewerProfileSource_fetchStatus_idx" ON "InterviewerProfileSource"("fetchStatus");

-- CreateIndex
CREATE INDEX "InterviewSession_userId_createdAt_idx" ON "InterviewSession"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "InterviewSession_status_idx" ON "InterviewSession"("status");

-- CreateIndex
CREATE INDEX "InterviewSession_interviewerProfileId_idx" ON "InterviewSession"("interviewerProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionInterviewerContext_sessionId_key" ON "SessionInterviewerContext"("sessionId");

-- CreateIndex
CREATE INDEX "SessionInterviewerContext_interviewerProfileId_idx" ON "SessionInterviewerContext"("interviewerProfileId");

-- CreateIndex
CREATE INDEX "SessionEvent_sessionId_eventTime_idx" ON "SessionEvent"("sessionId", "eventTime");

-- CreateIndex
CREATE INDEX "TranscriptSegment_sessionId_segmentIndex_idx" ON "TranscriptSegment"("sessionId", "segmentIndex");

-- CreateIndex
CREATE INDEX "CodeSnapshot_sessionId_snapshotIndex_idx" ON "CodeSnapshot"("sessionId", "snapshotIndex");

-- CreateIndex
CREATE INDEX "ExecutionRun_sessionId_createdAt_idx" ON "ExecutionRun"("sessionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Evaluation_sessionId_key" ON "Evaluation"("sessionId");

-- CreateIndex
CREATE INDEX "EvaluationDimensionScore_evaluationId_idx" ON "EvaluationDimensionScore"("evaluationId");

-- CreateIndex
CREATE UNIQUE INDEX "FeedbackReport_sessionId_key" ON "FeedbackReport"("sessionId");

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionHint" ADD CONSTRAINT "QuestionHint_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionFollowup" ADD CONSTRAINT "QuestionFollowup_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionRubric" ADD CONSTRAINT "QuestionRubric_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferenceSolution" ADD CONSTRAINT "ReferenceSolution_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewerProfileSource" ADD CONSTRAINT "InterviewerProfileSource_interviewerProfileId_fkey" FOREIGN KEY ("interviewerProfileId") REFERENCES "InterviewerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewSession" ADD CONSTRAINT "InterviewSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewSession" ADD CONSTRAINT "InterviewSession_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewSession" ADD CONSTRAINT "InterviewSession_interviewerProfileId_fkey" FOREIGN KEY ("interviewerProfileId") REFERENCES "InterviewerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionInterviewerContext" ADD CONSTRAINT "SessionInterviewerContext_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "InterviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionInterviewerContext" ADD CONSTRAINT "SessionInterviewerContext_interviewerProfileId_fkey" FOREIGN KEY ("interviewerProfileId") REFERENCES "InterviewerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionEvent" ADD CONSTRAINT "SessionEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "InterviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TranscriptSegment" ADD CONSTRAINT "TranscriptSegment_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "InterviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodeSnapshot" ADD CONSTRAINT "CodeSnapshot_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "InterviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutionRun" ADD CONSTRAINT "ExecutionRun_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "InterviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutionRun" ADD CONSTRAINT "ExecutionRun_codeSnapshotId_fkey" FOREIGN KEY ("codeSnapshotId") REFERENCES "CodeSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "InterviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationDimensionScore" ADD CONSTRAINT "EvaluationDimensionScore_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "Evaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackReport" ADD CONSTRAINT "FeedbackReport_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "InterviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
