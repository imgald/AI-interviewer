type SessionEventLike = {
  eventType: string;
  payloadJson?: unknown;
};

export type PivotMoment = {
  detected: boolean;
  type: "self_correction" | "insight_jump" | null;
  impactScore: number;
  evidenceRefs: string[];
  reason: string;
};

export function detectPivotMoment(input: {
  recentEvents: SessionEventLike[];
  decision: unknown;
}): PivotMoment {
  const decision = asRecord(input.decision);
  const target = normalize(stringValue(decision.target)) ?? "";
  const action = normalize(stringValue(decision.action)) ?? "";

  const hintRecentlyServed = hasRecentEvent(input.recentEvents, "HINT_SERVED", 14);
  if (!hintRecentlyServed) {
    return {
      detected: false,
      type: null,
      impactScore: 0,
      evidenceRefs: [],
      reason: "No recent hint served, so pivot gate did not open.",
    };
  }

  const previousTargets = recentDecisionTargets(input.recentEvents, 6);
  const targetDimension = mapTargetToDesignDimension(target);
  const newDimensionAdded = Boolean(targetDimension && !previousTargets.includes(targetDimension));
  if (!newDimensionAdded) {
    return {
      detected: false,
      type: null,
      impactScore: 0,
      evidenceRefs: [`target=${target || "none"}`, `recent_targets=${previousTargets.join(",") || "none"}`],
      reason: "No new design dimension was added after hint.",
    };
  }

  const improvement = detectDesignSignalImprovement(input.recentEvents);
  if (!improvement.improved) {
    return {
      detected: false,
      type: null,
      impactScore: 0,
      evidenceRefs: improvement.evidenceRefs,
      reason: "No significant design-signal improvement was detected.",
    };
  }

  const type: PivotMoment["type"] =
    action.includes("probe") || action.includes("ask_followup") ? "insight_jump" : "self_correction";
  const impactScore = Number(Math.min(1, 0.4 + 0.2 * improvement.delta).toFixed(2));

  return {
    detected: true,
    type,
    impactScore,
    evidenceRefs: [
      "recent_hint_served=true",
      `new_dimension=${targetDimension}`,
      `signal_improvement_delta=${improvement.delta}`,
      ...improvement.evidenceRefs,
    ],
    reason: "Hint + new dimension + significant design improvement detected.",
  };
}

function detectDesignSignalImprovement(events: SessionEventLike[]) {
  const snapshots = events
    .filter((event) => event.eventType === "SIGNAL_SNAPSHOT_RECORDED")
    .map((event) => asRecord(asRecord(asRecord(event.payloadJson).signals).designSignals).signals)
    .map((signals) => ({
      requirement_missing: booleanValue(signals.requirement_missing),
      capacity_missing: booleanValue(signals.capacity_missing),
      tradeoff_missed: booleanValue(signals.tradeoff_missed),
      spof_missed: booleanValue(signals.spof_missed),
      bottleneck_unexamined: booleanValue(signals.bottleneck_unexamined),
    }))
    .filter((item) => item !== null) as Array<{
    requirement_missing: boolean;
    capacity_missing: boolean;
    tradeoff_missed: boolean;
    spof_missed: boolean;
    bottleneck_unexamined: boolean;
  }>;

  if (snapshots.length < 2) {
    return {
      improved: false,
      delta: 0,
      evidenceRefs: ["Not enough signal snapshots to compute improvement."],
    };
  }

  const previous = snapshots[snapshots.length - 2];
  const latest = snapshots[snapshots.length - 1];
  const keys: Array<keyof typeof previous> = [
    "requirement_missing",
    "capacity_missing",
    "tradeoff_missed",
    "spof_missed",
    "bottleneck_unexamined",
  ];

  let delta = 0;
  for (const key of keys) {
    if (previous[key] && !latest[key]) {
      delta += 1;
    }
  }

  return {
    improved: delta >= 1,
    delta,
    evidenceRefs: [
      `previous_missing=${keys.filter((key) => previous[key]).length}`,
      `latest_missing=${keys.filter((key) => latest[key]).length}`,
    ],
  };
}

function recentDecisionTargets(events: SessionEventLike[], limit: number) {
  const targets: string[] = [];
  for (let index = events.length - 1; index >= 0 && targets.length < limit; index -= 1) {
    const event = events[index];
    if (!event || event.eventType !== "DECISION_RECORDED") {
      continue;
    }
    const decision = asRecord(asRecord(event.payloadJson).decision);
    const mapped = mapTargetToDesignDimension(normalize(stringValue(decision.target)) ?? "");
    if (mapped) {
      targets.push(mapped);
    }
  }
  return targets;
}

function mapTargetToDesignDimension(target: string) {
  if (target.includes("requirement") || target.includes("understanding")) {
    return "requirement";
  }
  if (target.includes("capacity")) {
    return "capacity";
  }
  if (target.includes("tradeoff")) {
    return "tradeoff";
  }
  if (target.includes("spof") || target.includes("correctness")) {
    return "spof";
  }
  if (target.includes("bottleneck") || target.includes("approach")) {
    return "bottleneck";
  }
  return null;
}

function hasRecentEvent(events: SessionEventLike[], eventType: string, lookback: number) {
  let seen = 0;
  for (let index = events.length - 1; index >= 0 && seen < lookback; index -= 1) {
    const event = events[index];
    if (!event) {
      continue;
    }
    seen += 1;
    if (event.eventType === eventType) {
      return true;
    }
  }
  return false;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function stringValue(value: unknown) {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return String(value);
  }
  return null;
}

function normalize(value: string | null) {
  return value ? value.trim().toLowerCase() : null;
}

function booleanValue(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

