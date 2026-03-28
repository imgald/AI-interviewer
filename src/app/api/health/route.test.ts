import { beforeEach, describe, expect, it, vi } from "vitest";

const getHealthSnapshot = vi.fn();

vi.mock("@/lib/health", () => ({
  getHealthSnapshot,
}));

describe("GET /api/health", () => {
  beforeEach(() => {
    getHealthSnapshot.mockReset();
  });

  it("returns 200 when dependencies are healthy", async () => {
    getHealthSnapshot.mockResolvedValue({
      status: "ok",
      timestamp: "2026-03-28T00:00:00.000Z",
      dependencies: {
        db: { status: "ok", latencyMs: 5 },
        redis: { status: "ok", latencyMs: 2 },
      },
    });

    const { GET } = await import("@/app/api/health/route");
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.status).toBe("ok");
  });

  it("returns 503 when one dependency is degraded", async () => {
    getHealthSnapshot.mockResolvedValue({
      status: "degraded",
      timestamp: "2026-03-28T00:00:00.000Z",
      dependencies: {
        db: { status: "ok", latencyMs: 5 },
        redis: { status: "error", latencyMs: 20, details: "Connection refused" },
      },
    });

    const { GET } = await import("@/app/api/health/route");
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.ok).toBe(false);
    expect(payload.status).toBe("degraded");
  });
});
