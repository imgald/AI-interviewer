# Go-Live Runbook

This runbook is the operational playbook for releasing the system-design interviewer stack.

## Release Scope

Included:
- Unified scoring and level calibration
- System-design regression and stability gates
- Report audit and evidence drill-down UX

Excluded:
- New model/provider migrations
- DB schema migrations not already validated in staging

## Preconditions

1. Branch state
- `main` is green
- no unresolved release-blocking bugs

2. Infra state
- Postgres healthy (`/api/health/db`)
- Redis healthy (`/api/health`)

3. Quality gates
- `npm run check:system-design-gates` must pass
- `npm run check:system-design-alerts` must be `status=ok` or explicitly waived by release owner

## Go-Live Checklist

1. Pre-flight (T-60m)
- Pull latest `main`
- Install deps: `npm ci`
- Build: `npm run build`
- Test:
  - `npm run test`
  - `npm run check:system-design-gates`
  - `npm run check:system-design-alerts`

2. Snapshot freeze (T-30m)
- Run weekly snapshot:
  - `npm run eval:system-design:weekly`
- Confirm `docs/metrics/system-design-weekly/latest.json` updated
- Save release baseline values:
  - calibration accuracy
  - regression pass rate
  - drift delta
  - replay variance

3. Deploy (T-0)
- Deploy app artifact
- Restart app process(es)
- Restart worker process(es) if release includes queue behavior changes

4. Post-deploy smoke (T+10m)
- Open:
  - `/setup`
  - `/interview/:id` (coding + system design paths)
  - `/report/:id`
  - `/admin`
- Verify:
  - system design report renders radar + evidence pins
  - transcript drill-down links jump to highlighted spans
  - no spike in API errors for `/api/sessions/:id/report`

5. Post-deploy validation (T+30m)
- Run:
  - `npm run check:system-design-alerts`
- Confirm no `critical` alerts
- Announce release completion with baseline metrics

## Rollback Conditions

Rollback immediately if any of these occurs:
- `check:system-design-alerts` returns `critical` twice in a row
- regression pass rate drops below `0.98`
- calibration accuracy drops below `0.70`
- report generation endpoint has sustained production failures

## Rollback Procedure

1. Identify previous known-good commit/tag.
2. Redeploy previous artifact.
3. Restart web + worker processes.
4. Re-run smoke checks:
- `/setup`, `/interview/:id`, `/report/:id`, `/admin`
- `npm run check:system-design-alerts`
5. Mark incident with:
- rollback timestamp
- trigger metric(s)
- suspect commit range

## Incident Logging Template

- Release ID:
- Start time:
- Trigger:
- Impact:
- Mitigation:
- Rollback: yes/no
- Follow-up owner:
- ETA for permanent fix:

## Roles

- Release owner: executes checklist and final go/no-go
- Quality owner: validates scoring/calibration metrics
- On-call engineer: handles runtime incidents and rollback

## Communication Plan

Before release:
- share planned window and owner list

After release:
- share:
  - commit hash
  - baseline metrics
  - alert status

If rollback:
- share rollback reason, impact window, and follow-up timeline

