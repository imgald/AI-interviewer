# AI Interviewer

Voice-first mock interview app for North American SDE interview prep, starting with coding interviews and an optional public interviewer persona flow.

## Current Status

This repo now has a working MVP skeleton with:

- `Next.js + TypeScript` app router frontend and API routes
- `Postgres + Redis` local infra via Docker Compose
- `Prisma` data model for sessions, interviewer profiles, persona context, evaluations, and event history
- Optional interviewer profile setup flow
- `BullMQ`-backed persona ingestion queue with a worker process
- Persona queue observability in both setup UI and admin dashboard
- Interview room with transcript persistence, stage-aware assistant turns, Monaco editor, local code execution, and streaming AI replies
- Default interviewer skills layer for tone, pacing, follow-up discipline, and coaching-without-spoiling
- Browser voice loop with interruption handling, continuous listening, and turn-taking policies
- `Vitest` unit/route tests and `Playwright` end-to-end tests

## Recent Progress

- Added stage-aware coding interview orchestration:
  - current stage is derived from transcripts, session events, and the latest code run
  - assistant turns receive explicit stage context
  - `STAGE_ADVANCED` is only recorded when the stage actually changes
- Improved the interview room so it feels more like a real conversation:
  - streaming AI replies over `SSE`
  - continuous listening mode
  - candidate speech interrupts AI playback and generation
  - adaptive silence thresholds for auto-submit
  - short interruption phrases like `wait` and `hold on` are ignored instead of being treated as full candidate turns
- Replaced the static code panel with a real Monaco editor
- Added session code execution flow:
  - `CodeSnapshot` records are created on run
  - `ExecutionRun` records are persisted
  - session timeline includes code-run-related events
- Added multi-provider LLM support for interviewer turns:
  - `Gemini`
  - `OpenAI`
  - local `fallback`
- Improved interviewer quality with a shared interviewer-skills layer:
  - warmer but still professional tone
  - clearer pacing
  - better follow-up discipline
  - less repetitive phrasing
- Improved `/admin` unified operations feed:
  - richer descriptions for session lifecycle events
  - readable stage transition descriptions
  - persona and session activity rendered in one timeline
- Expanded tests around:
  - assistant stage inference
  - assistant-turn generation and stage transitions
  - streaming routes
  - voice turn-taking policies
  - admin feed event descriptions

## What Works Today

### Product Flow

- `/setup`
  - Choose interview mode, level, language, company style, difficulty, and voice toggle
  - Optionally paste a public interviewer profile URL
  - Analyze the profile and watch queue state move through setup UI
- `/interview/[id]`
  - Session room renders selected question and interviewer context
  - Browser speech recognition can capture candidate speech into transcript storage
  - AI assistant turns can be generated from recent transcript, current stage, persona context, and latest code run
  - AI replies stream into the UI over `SSE`
  - Browser TTS speaks AI replies with a queued utterance model
  - Candidate speech can interrupt AI playback and generation
  - Continuous listening mode can auto-submit candidate turns after a content-aware silence threshold
  - Monaco editor is wired for coding sessions
  - Local sandbox execution supports Python and JavaScript today
- `/admin`
  - Inspect recent interviewer profiles
  - View raw queue job state
  - View persona pipeline events
  - View unified persona and session operations feed with readable lifecycle descriptions

### Backend Flow

- `POST /api/interviewer-profiles/preview`
- `POST /api/interviewer-profiles`
- `GET /api/interviewer-profiles/:id`
- `GET /api/interviewer-profiles/:id/job`
- `GET /api/interviewer-profiles/:id/events`
- `POST /api/sessions`
- `GET /api/sessions/:id`
- `POST /api/sessions/:id/assistant-turn`
- `POST /api/sessions/:id/assistant-turn/stream`
- `GET /api/sessions/:id/transcripts`
- `POST /api/sessions/:id/transcripts`
- `GET /api/sessions/:id/events`
- `POST /api/sessions/:id/events`
- `GET /api/sessions/:id/code-runs`
- `POST /api/sessions/:id/code-runs`
- `GET /api/health`
- `GET /api/health/db`

### Queue Behavior

- Persona ingestion jobs run through `BullMQ`
- Worker supports simulated scenarios for local development:
  - normal success
  - transient retry then success
  - final failure with fallback
- Queue and worker events are written to `PersonaJobEvent`

## Local Architecture

### App Layer

- `src/app/setup/page.tsx`
- `src/app/interview/[id]/page.tsx`
- `src/app/admin/page.tsx`

### Core Libraries

- `src/lib/db.ts`: Prisma client
- `src/lib/redis.ts`: Redis connection
- `src/lib/health.ts`: DB and Redis health aggregation
- `src/lib/admin/ops.ts`: admin dashboard data aggregation
- `src/lib/assistant/stages.ts`: coding interview stage inference and progression helpers
- `src/lib/assistant/generate-turn.ts`: multi-provider assistant turn generation and streaming
- `src/lib/persona/queue.ts`: BullMQ queue helpers
- `src/lib/persona/fake-ingestion.ts`: local persona ingestion simulation
- `src/lib/persona/job-events.ts`: persona event persistence
- `src/lib/voice/browser-voice-adapter.ts`: browser speech recognition and synthesis adapter
- `src/lib/voice/turn-taking.ts`: interruption-aware silence and commit timing policy

### Worker

- `src/workers/persona-worker.ts`

### Database

- Prisma schema: `prisma/schema.prisma`
- Migrations:
  - `prisma/migrations/20260328000000_init`
  - `prisma/migrations/20260328010000_persona_job_events`

## Local Development

### 1. Start Infra

```powershell
Set-Location 'E:\AI interviewer'
docker compose up -d
```

### 2. Start App

```powershell
Set-Location 'E:\AI interviewer'
npm run dev
```

### 3. Start Persona Worker

In a second terminal:

```powershell
Set-Location 'E:\AI interviewer'
npm run worker:persona
```

### 4. Open the App

- Setup: [http://localhost:3000/setup](http://localhost:3000/setup)
- Admin: [http://localhost:3000/admin](http://localhost:3000/admin)
- Health: [http://localhost:3000/api/health](http://localhost:3000/api/health)

## Environment Variables

See `.env.example`

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ai_interviewer?schema=public"
REDIS_URL="redis://localhost:6379"
LLM_PROVIDER=""
GEMINI_API_KEY=""
GEMINI_MODEL="gemini-2.5-flash"
OPENAI_API_KEY=""
OPENAI_MODEL="gpt-4.1-mini"
```

## Test Commands

### Unit and Route Tests

```powershell
npm run test
```

### End-to-End Tests

```powershell
npm run test:e2e
```

### Production Build

```powershell
npm run build
```

## Current Test Coverage

### Vitest

- Persona URL normalization
- Persona source type detection
- Health route behavior
- Interviewer profile preview route behavior
- Sessions route behavior
- Assistant-turn fallback generation and stage-aware behavior
- Stage inference and progression
- Streaming assistant-turn route behavior
- Voice turn-taking policy behavior
- Session code-run route behavior
- Admin unified feed aggregation

### Playwright

- Setup -> persona queue -> admin visibility
- Setup -> tailored session creation -> interview room persona rendering

## Known Limitations

- Persona ingestion is still simulated; it does not yet fetch and summarize real public web pages
- Realtime AI conversation is still browser speech recognition plus `SSE` streaming rather than a full duplex low-latency voice stack
- Browser speech recognition depends on Web Speech API availability and varies by browser
- Code execution is local-process based and currently supports Python and JavaScript only
- Authentication is still stubbed around a demo user
- Session lifecycle coverage is much better than before, but evaluation and report events are still shallow
- Prisma generation on Windows can fail if `dev` or `worker` processes are locking the Prisma engine file

## Next Recommended Work

### Product and Backend

- Replace fake persona ingestion with real public-page fetching, extraction, and summarization
- Add stronger interview policy on top of the new stage system:
  - explicit exit criteria per stage
  - hinting rules tied to stage
  - code-run outcomes feeding stage transitions more directly
- Expand code execution from local process execution to a stronger sandbox model
- Add report generation and evaluation pipeline

### Queue and Observability

- Add admin filters by status, source type, and time range
- Add explicit per-session timeline and stage journey view in admin
- Add queue metrics and failure counts
- Add retry controls or requeue actions in admin

### Testing

- Add route and integration tests for interviewer profile creation, polling, job events, and admin APIs
- Add worker-level integration tests for:
  - retry-once success
  - permanent failure
  - event persistence completeness
- Add Playwright flows for:
  - generic session launch
  - retry persona flow
  - final fallback flow

## Suggested Near-Term Milestones

### Milestone 1

- Real persona ingestion pipeline
- Better admin filtering
- More worker and route tests

### Milestone 2

- Stronger realtime interview room
- Better stage orchestration and room controls
- Richer evaluation and replay signals

### Milestone 3

- Evaluation and feedback report generation
- System design mode
- Personalized study history and analytics
