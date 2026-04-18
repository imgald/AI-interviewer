import { fail } from "@/lib/http";

type GuardScope = "session_create" | "assistant_turn" | "transcript_write" | "event_write";

type RateWindowRecord = {
  windowStart: number;
  count: number;
};

const WINDOW_MS = 60_000;
const rateWindows = new Map<string, RateWindowRecord>();

export function enforceMutationGuard(request: Request, scope: GuardScope) {
  const rateLimitEnabled = process.env.API_RATE_LIMIT_ENABLED === "1";
  if (!rateLimitEnabled) {
    return null;
  }

  const key = `${scope}:${resolveClientAddress(request)}`;
  const now = Date.now();
  const limit = resolveScopeLimit(scope);
  const current = rateWindows.get(key);

  if (!current || now - current.windowStart >= WINDOW_MS) {
    rateWindows.set(key, { windowStart: now, count: 1 });
    return null;
  }

  if (current.count >= limit) {
    return fail("Rate limit exceeded", 429, {
      scope,
      windowMs: WINDOW_MS,
      limit,
    });
  }

  current.count += 1;
  rateWindows.set(key, current);
  return null;
}

function resolveClientAddress(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded && forwarded.trim().length > 0) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp && realIp.trim().length > 0) {
    return realIp.trim();
  }
  return "unknown";
}

function resolveScopeLimit(scope: GuardScope) {
  switch (scope) {
    case "session_create":
      return intFromEnv("SESSION_CREATE_RATE_LIMIT_RPM", 30);
    case "assistant_turn":
      return intFromEnv("ASSISTANT_TURN_RATE_LIMIT_RPM", 120);
    case "transcript_write":
      return intFromEnv("TRANSCRIPT_WRITE_RATE_LIMIT_RPM", 240);
    case "event_write":
      return intFromEnv("EVENT_WRITE_RATE_LIMIT_RPM", 240);
  }
}

function intFromEnv(name: string, fallback: number) {
  const raw = process.env[name];
  const parsed = raw ? Number(raw) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

