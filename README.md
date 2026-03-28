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
- Interview room with transcript persistence, Monaco editor, local code execution, and minimal assistant-turn generation
- Default interviewer skills layer for tone, pacing, follow-up discipline, and coaching-without-spoiling
- `Vitest` unit/route tests and `Playwright` end-to-end tests

## Today’s Progress

- Added a browser-voice interview loop skeleton:
  - candidate speech can be captured with Web Speech API
  - transcript segments persist to Postgres
  - AI replies can be spoken back in the room
- Replaced the static code panel with a real Monaco editor
- Added session code execution flow:
  - `CodeSnapshot` records are created on run
  - `ExecutionRun` records are persisted
  - session timeline now includes code-run-related events
- Added `/api/sessions/:id/assistant-turn` so the interviewer can generate the next turn from:
  - recent transcript
  - interviewer persona context
  - latest code run result
- Added multi-provider LLM support for interviewer turns:
  - `Gemini`
  - `OpenAI`
  - local `fallback`
- Improved interviewer quality with a shared interviewer-skills layer:
  - warmer but still professional tone
  - clearer pacing
  - better follow-up discipline
  - less repetitive phrasing
- Reduced “AI stopped halfway” issues by:
  - increasing Gemini output budget
  - normalizing model replies to complete sentence endings
  - queueing browser TTS instead of always cancelling the previous utterance
- Expanded tests around:
  - assistant-turn generation
  - code-run routes
  - fallback interviewer behavior

## What Works Today

### Product flow

- `/setup`
  - Choose interview mode, level, language, company style, difficulty, and voice toggle
  - Optionally paste a public interviewer profile URL
  - Analyze the profile and watch queue state move through setup UI
- `/interview/[id]`
  - Session room renders selected question and interviewer context
  - Browser speech recognition can capture candidate speech into transcript storage
  - AI assistant turns can be generated from recent transcript and latest code run
  - Monaco editor is wired for coding sessions
  - Local sandbox execution supports Python and JavaScript today
- `/admin`
  - Inspect recent interviewer profiles
  - View raw queue job state
  - View persona pipeline events
  - View unified persona + session operations feed

### Backend flow

- `POST /api/interviewer-profiles/preview`
- `POST /api/interviewer-profiles`
- `GET /api/interviewer-profiles/:id`
- `GET /api/interviewer-profiles/:id/job`
- `GET /api/interviewer-profiles/:id/events`
- `POST /api/sessions`
- `POST /api/sessions/:id/assistant-turn`
- `GET /api/sessions/:id/code-runs`
- `POST /api/sessions/:id/code-runs`
- `GET /api/health`
- `GET /api/health/db`

### Queue behavior

- Persona ingestion jobs run through `BullMQ`
- Worker supports simulated scenarios for local development:
  - normal success
  - transient retry then success
  - final failure with fallback
- Queue and worker events are written to `PersonaJobEvent`

## Local Architecture

### App layer

- `src/app/setup/page.tsx`
- `src/app/interview/[id]/page.tsx`
- `src/app/admin/page.tsx`

### Core libraries

- `src/lib/db.ts`: Prisma client
- `src/lib/redis.ts`: Redis connection
- `src/lib/health.ts`: DB + Redis health aggregation
- `src/lib/admin/ops.ts`: admin dashboard data aggregation
- `src/lib/persona/queue.ts`: BullMQ queue helpers
- `src/lib/persona/fake-ingestion.ts`: local persona ingestion simulation
- `src/lib/persona/job-events.ts`: persona event persistence

### Worker

- `src/workers/persona-worker.ts`

### Database

- Prisma schema: `prisma/schema.prisma`
- Migrations:
  - `prisma/migrations/20260328000000_init`
  - `prisma/migrations/20260328010000_persona_job_events`

## Local Development

### 1. Start infra

```powershell
Set-Location 'E:\AI interviewer'
docker compose up -d
```

### 2. Start app

```powershell
Set-Location 'E:\AI interviewer'
npm run dev
```

### 3. Start persona worker

In a second terminal:

```powershell
Set-Location 'E:\AI interviewer'
npm run worker:persona
```

### 4. Open the app

- Setup: [http://localhost:3000/setup](http://localhost:3000/setup)
- Admin: [http://localhost:3000/admin](http://localhost:3000/admin)
- Health: [http://localhost:3000/api/health](http://localhost:3000/api/health)

## Environment Variables

See [.env.example](E:\AI interviewer\.env.example)

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

### Unit and route tests

```powershell
npm run test
```

### End-to-end tests

```powershell
npm run test:e2e
```

### Production build

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
- Assistant-turn fallback generation
- Session code-run route behavior
- Admin unified feed aggregation

### Playwright

- Setup -> persona queue -> admin visibility
- Setup -> tailored session creation -> interview room persona rendering

## Known Limitations

- Persona ingestion is still simulated; it does not yet fetch and summarize real public web pages
- Realtime AI conversation is still a minimal request/response loop rather than a low-latency streaming voice system
- Browser speech recognition depends on Web Speech API availability and varies by browser
- Code execution is local-process based and currently supports Python and JavaScript only
- Authentication is still stubbed around a demo user
- Session lifecycle coverage is still shallow compared with the persona pipeline
- Prisma generation on Windows can fail if `dev` or `worker` processes are locking the Prisma engine file

## Next Recommended Work

### Product and backend

- Replace fake persona ingestion with real public-page fetching, extraction, and summarization
- Upgrade assistant turns from minimal request/response to realtime streaming voice interaction
- Expand code execution from local process execution to a stronger sandbox model
- Expand interview session lifecycle events beyond `SESSION_CREATED`
- Add report generation and evaluation pipeline

### Queue and observability

- Add admin filters by status, source type, and time range
- Add explicit session event timeline in admin
- Add queue metrics and failure counts
- Add retry controls or requeue actions in admin

### Testing

- Add route/integration tests for interviewer profile creation, polling, job events, and admin APIs
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

- Realtime interview room
- Code editor and execution
- Richer session lifecycle tracking

### Milestone 3

- Evaluation and feedback report generation
- System design mode
- Personalized study history and analytics
