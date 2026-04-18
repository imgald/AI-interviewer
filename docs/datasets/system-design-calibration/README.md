# Real Transcript Calibration Pack

This folder documents how to build and maintain the real transcript calibration dataset.

## Goal

Use real, labeled system-design sessions to calibrate:
- level mapping (`Mid-level` / `Senior` / `Staff`)
- verdict mapping (`NO_HIRE` / `BORDERLINE` / `HIRE` / `STRONG_HIRE`)

## Canonical Dataset Path

- `data/system-design-calibration/real-transcripts.jsonl`

The file is intentionally not committed by default.

## JSONL Schema (one record per line)

```json
{
  "id": "real-0001",
  "source": "internal_reviewer_v1",
  "expected": {
    "level": "Senior",
    "verdict": "HIRE"
  },
  "scoringInput": {
    "signals": [
      { "key": "requirement_missing", "missing": false },
      { "key": "capacity_missing", "missing": false },
      { "key": "tradeoff_missed", "missing": false },
      { "key": "spof_missed", "missing": false },
      { "key": "bottleneck_unexamined", "missing": false }
    ],
    "gapState": {
      "missing_capacity": false,
      "missing_tradeoff": false,
      "missing_reliability": false,
      "missing_bottleneck": false
    },
    "pivots": [{ "turnId": "turn-12", "triggerAction": "LIGHT", "impactScore": 0.42 }],
    "noiseTags": [],
    "metadata": {
      "stage": "DEEP_DIVE",
      "targetLevel": "SENIOR"
    },
    "decisionTrace": [{ "turnId": "turn-11", "action": "probe_tradeoff", "rescueMode": "none" }],
    "rewardTrace": [{ "turnId": "turn-12", "total": 0.41, "noiseTags": [] }]
  },
  "notes": "Manually reviewed by panel-2026-04-18"
}
```

## Commands

Run standard synthetic + regression bundle:

```powershell
npm run eval:system-design
```

Run real transcript calibration only:

```powershell
npm run eval:system-design:real -- --in data/system-design-calibration/real-transcripts.jsonl
```

Write JSON output:

```powershell
npm run eval:system-design:real -- --in data/system-design-calibration/real-transcripts.jsonl --out artifacts/real-calibration-eval.json
```

## Labeling Policy

1. Every sample must have a human-reviewed `expected.level` and `expected.verdict`.
2. Exclude low-integrity sessions:
- broken transcript chains
- severe STT corruption
- interrupted sessions without enough evidence
3. Keep level distribution balanced (target):
- Mid-level: 30%+
- Senior: 30%+
- Staff: 30%+
4. Track label provenance in `source` and `notes`.

## Data Hygiene

- Remove PII before adding examples.
- Keep user/company identifiers anonymized.
- Prefer short notes with reviewer/date provenance.

